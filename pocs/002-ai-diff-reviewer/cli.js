#!/usr/bin/env node
'use strict';

// Usage:
//   git diff --staged | node cli.js          # review staged changes
//   node cli.js --staged                     # same, runs git for you
//   node cli.js --mock < some.diff           # offline demo, no API key
// Env: ANTHROPIC_API_KEY, ANTHROPIC_MODEL (optional)

const { execSync } = require('node:child_process');
const { buildPrompt, parseReview, toMarkdown, filterNoise } = require('./src/prompt');
const { callClaude, mockReview } = require('./src/client');

async function readStdin() {
  if (process.stdin.isTTY) return '';
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  const diff = args.includes('--staged')
    ? execSync('git diff --staged', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    : await readStdin();

  if (!diff.trim()) {
    console.error('No diff to review. Stage some changes or pipe a diff in.');
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const useMock = args.includes('--mock') || !apiKey;
  if (useMock && !args.includes('--mock')) console.error('(No ANTHROPIC_API_KEY set, using --mock)\n');

  const prompt = buildPrompt(diff);
  const raw = useMock
    ? mockReview(filterNoise(diff))
    : await callClaude({ ...prompt, apiKey, model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5' });

  const review = parseReview(raw);
  console.log(toMarkdown(review));
  if (args.includes('--fail-on-high') && review.findings.some((f) => f.severity === 'high')) process.exit(2);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
