'use strict';

// Demo HTTP server: per-IP token bucket on every request.
// Run: node server.js   then: for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code}\n" localhost:3000; done

const http = require('node:http');
const { TokenBucketLimiter } = require('./src/tokenBucket');

const limiter = new TokenBucketLimiter({ capacity: 10, refillPerSec: 2 });
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const key = req.socket.remoteAddress || 'unknown';
  const result = limiter.take(key);

  res.setHeader('X-RateLimit-Limit', limiter.capacity);
  res.setHeader('X-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000));
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Too Many Requests', retryAfterMs: result.retryAfterMs }));
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, remaining: result.remaining }));
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Rate limiter demo on http://localhost:${PORT}`));
}

module.exports = { server };
