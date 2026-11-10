'use strict';
const crypto = require('node:crypto');

const MAX_KEY_LENGTH = 255;

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

// Replays the stored response for a repeated Idempotency-Key, rejects reuse of a
// key with a different payload (422), and records the first response otherwise.
// Server errors (5xx) are not stored so the client can retry safely.
function idempotency(db) {
  const find = db.prepare('SELECT request_hash, status_code, response_body FROM idempotency_keys WHERE key = ?');
  const save = db.prepare(
    'INSERT OR IGNORE INTO idempotency_keys (key, request_hash, status_code, response_body) VALUES (?, ?, ?, ?)',
  );

  return (req, res, next) => {
    if (req.method !== 'POST') return next();
    const key = req.get('Idempotency-Key');
    if (key === undefined) return next();
    if (!key || key.length > MAX_KEY_LENGTH) {
      return res.status(400).json({ error: `Idempotency-Key must be 1-${MAX_KEY_LENGTH} characters` });
    }

    const requestHash = hashRequest(req);
    const stored = find.get(key);
    if (stored) {
      if (stored.request_hash !== requestHash) {
        return res.status(422).json({ error: 'Idempotency-Key was already used with a different request' });
      }
      res.set('Idempotent-Replayed', 'true');
      return res.status(stored.status_code).type('application/json').send(stored.response_body);
    }

    const send = res.send.bind(res);
    res.send = (body) => {
      if (res.statusCode < 500) {
        save.run(key, requestHash, res.statusCode, typeof body === 'string' ? body : JSON.stringify(body));
      }
      return send(body);
    };
    next();
  };
}

module.exports = { idempotency, hashRequest };
