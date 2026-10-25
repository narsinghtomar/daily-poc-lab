'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { truncateDiff, filterNoise, buildPrompt, parseReview, toMarkdown } = require('../src/prompt');
const { callClaude, mockReview } = require('../src/client');

const d = (file, body = '+x') => `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n${body}\n`;

test('filterNoise drops lockfiles but keeps source', () => {
  const out = filterNoise(d('src/a.js') + d('package-lock.json') + d('pubspec.lock') + d('lib/b.dart'));
  assert.match(out, /src\/a\.js/);
  assert.match(out, /lib\/b\.dart/);
  assert.doesNotMatch(out, /package-lock/);
  assert.doesNotMatch(out, /pubspec\.lock/);
});

test('truncateDiff cuts on a file boundary', () => {
  const diff = d('a.js', '+' + 'a'.repeat(50)) + d('b.js', '+' + 'b'.repeat(50));
  const { text, truncated } = truncateDiff(diff, 100);
  assert.equal(truncated, true);
  assert.match(text, /a\.js/);
  assert.doesNotMatch(text, /b\.js/);
});

test('buildPrompt asks for JSON and wraps the diff', () => {
  const p = buildPrompt(d('a.js'));
  assert.match(p.system, /JSON only/);
  assert.match(p.user, /<diff>[\s\S]*a\.js[\s\S]*<\/diff>/);
});

test('parseReview strips code fences and validates', () => {
  const raw = '```json\n{"summary":"ok","risk":"low","findings":[],"commitMessage":"feat: add x"}\n```';
  assert.equal(parseReview(raw).commitMessage, 'feat: add x');
});

test('parseReview rejects bad shapes and drops bad findings', () => {
  assert.throws(() => parseReview('not json'), /valid JSON/);
  assert.throws(() => parseReview('{"summary":"x","risk":"extreme","findings":[],"commitMessage":"y"}'), /risk/);
  const r = parseReview(JSON.stringify({
    summary: 's', risk: 'medium', commitMessage: 'fix: ' + 'z'.repeat(100),
    findings: [{ file: 'a', severity: 'high', issue: 'bug' }, { file: 'b', severity: 'urgent', issue: 'x' }],
  }));
  assert.equal(r.findings.length, 1);
  assert.equal(r.commitMessage.length, 72);
});

test('mock review flags hard-coded secrets', () => {
  const r = parseReview(mockReview(d('config.js', '+const API_KEY = "sk-123"')));
  assert.equal(r.risk, 'high');
  assert.match(toMarkdown(r), /hard-coded secret/);
});

test('callClaude retries on 429 then succeeds', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429, text: async () => 'slow down' };
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'hi' }] }) };
  };
  const out = await callClaude({ system: 's', user: 'u', apiKey: 'k', model: 'm', fetchImpl });
  assert.equal(out, 'hi');
  assert.equal(calls, 2);
});

test('callClaude does not retry on 400', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: false, status: 400, text: async () => 'bad' }; };
  await assert.rejects(callClaude({ system: 's', user: 'u', apiKey: 'k', model: 'm', fetchImpl }), /400/);
  assert.equal(calls, 1);
});
