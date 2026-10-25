'use strict';

// Minimal Anthropic Messages API client using built-in fetch (Node 18+).
// Retries on 429 / 5xx with exponential backoff + jitter.

const API_URL = 'https://api.anthropic.com/v1/messages';

async function callClaude({ system, user, apiKey, model, maxRetries = 3, fetchImpl = fetch }) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (res.ok) {
      const body = await res.json();
      return body.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= maxRetries) {
      throw new Error(`API error ${res.status}: ${await res.text()}`);
    }
    const delay = 2 ** attempt * 500 + Math.random() * 250;
    await new Promise((r) => setTimeout(r, delay));
  }
}

/** Offline stand-in so the demo runs in an interview without a key or network. */
function mockReview(diff) {
  const files = [...diff.matchAll(/^diff --git a\/(\S+)/gm)].map((m) => m[1]);
  const hasSecret = /(api[_-]?key|secret|password)\s*[:=]\s*['"][^'"]+['"]/i.test(diff);
  return JSON.stringify({
    summary: `Mock review of ${files.length} file(s).`,
    risk: hasSecret ? 'high' : 'low',
    findings: hasSecret
      ? [{ file: files[0] || 'unknown', line: null, severity: 'high', issue: 'Possible hard-coded secret', suggestion: 'Load it from environment or a secret manager' }]
      : [],
    commitMessage: `chore: update ${files[0] || 'files'}`,
  });
}

module.exports = { callClaude, mockReview };
