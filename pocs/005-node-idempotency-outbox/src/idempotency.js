'use strict';
const crypto = require('node:crypto');
const { setTimeout: sleep } = require('node:timers/promises');

const MAX_KEY_LENGTH = 255;
const DEFAULTS = {
  pollMs: 20, // how often a duplicate re-checks an in-progress key
  waitMs: 5_000, // how long a duplicate waits before answering 409
  lockTtlMs: 30_000, // an in-progress marker older than this is treated as abandoned
};

// Stable JSON: object keys sorted so {a,b} and {b,a} hash identically.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function hashRequest(req) {
  return crypto.createHash('sha256')
    .update(`${req.method}\n${req.path}\n${canonical(req.body ?? null)}`)
    .digest('hex');
}

function createKeyStore(db) {
  // One atomic statement claims the key: it inserts a fresh in-progress marker,
  // or takes over an abandoned one (same payload, lock older than the TTL).
  // changes === 1 means this request owns the key.
  const claim = db.prepare(`
    INSERT INTO idempotency_keys (key, request_hash, lock_token, locked_at)
    VALUES (@key, @hash, @token, @now)
    ON CONFLICT (key) DO UPDATE SET lock_token = excluded.lock_token, locked_at = excluded.locked_at
    WHERE status_code IS NULL AND request_hash = excluded.request_hash AND locked_at < @staleBefore`);
  const find = db.prepare('SELECT request_hash, status_code, response_body FROM idempotency_keys WHERE key = ?');
  const complete = db.prepare(`
    UPDATE idempotency_keys SET status_code = ?, response_body = ?, lock_token = NULL, locked_at = NULL
    WHERE key = ? AND lock_token = ?`);
  const release = db.prepare(
    'DELETE FROM idempotency_keys WHERE key = ? AND lock_token = ? AND status_code IS NULL',
  );

  return {
    claim: (key, hash, token, now, staleBefore) => claim.run({ key, hash, token, now, staleBefore }).changes === 1,
    find: (key) => find.get(key),
    complete: (key, token, status, body) => complete.run(status, body, key, token),
    release: (key, token) => release.run(key, token),
  };
}

// Idempotency-Key middleware for POST requests.
//  - First request inserts an in-progress marker, runs the handler and records
//    the response (status + body).
//  - A retry after completion replays the recorded response.
//  - A concurrent duplicate waits for the in-flight request and then replays the
//    same response; if it is still running after waitMs the duplicate gets 409.
//  - Reusing a key with a different payload is rejected with 422.
//  - 5xx responses (and responses written without res.send) release the marker,
//    so the client can retry and a waiting duplicate takes over. A marker whose
//    owner crashed is taken over once it is older than lockTtlMs.
function idempotency(db, options = {}) {
  const { pollMs, waitMs, lockTtlMs, now = Date.now } = { ...DEFAULTS, ...options };
  const store = createKeyStore(db);

  const replay = (res, row) => {
    res.set('Idempotent-Replayed', 'true');
    return res.status(row.status_code).type('application/json').send(row.response_body);
  };

  const record = (res, key, token) => {
    let settled = false;
    const send = res.send.bind(res);
    const end = res.end.bind(res);
    res.send = (body) => {
      // res.json() calls res.send() again with the serialised string; record once.
      if (!settled) {
        settled = true;
        if (res.statusCode < 500) {
          store.complete(key, token, res.statusCode, typeof body === 'string' ? body : JSON.stringify(body));
        } else {
          store.release(key, token);
        }
      }
      return send(body);
    };
    // Responses written without res.send (e.g. Express's default error handler)
    // carry no body we can replay, so release the key and let the client retry.
    // A dropped connection is deliberately not a release: the handler may still be
    // running, and releasing would let a retry execute it a second time.
    res.end = (...args) => {
      if (!settled) {
        settled = true;
        store.release(key, token);
      }
      return end(...args);
    };
  };

  return async (req, res, next) => {
    if (req.method !== 'POST') return next();
    const key = req.get('Idempotency-Key');
    if (key === undefined) return next();
    if (!key || key.length > MAX_KEY_LENGTH) {
      return res.status(400).json({ error: `Idempotency-Key must be 1-${MAX_KEY_LENGTH} characters` });
    }

    const requestHash = hashRequest(req);
    const token = crypto.randomUUID();
    const deadline = now() + waitMs;

    for (;;) {
      const t = now();
      if (store.claim(key, requestHash, token, t, t - lockTtlMs)) {
        record(res, key, token);
        return next();
      }

      const row = store.find(key);
      if (row) {
        if (row.request_hash !== requestHash) {
          return res.status(422).json({ error: 'Idempotency-Key was already used with a different request' });
        }
        if (row.status_code !== null) return replay(res, row);
      }
      // Still in progress (or just released): wait and try again.
      if (now() >= deadline) {
        res.set('Retry-After', '1');
        return res.status(409).json({ error: 'A request with this Idempotency-Key is still in progress' });
      }
      await sleep(pollMs);
    }
  };
}

module.exports = { idempotency, hashRequest };
