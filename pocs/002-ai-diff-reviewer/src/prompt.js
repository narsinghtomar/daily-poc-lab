'use strict';

const MAX_DIFF_CHARS = 24_000;
const SEVERITIES = ['high', 'medium', 'low'];

/** Keep the prompt within budget; cut on a file boundary when possible. */
function truncateDiff(diff, max = MAX_DIFF_CHARS) {
  if (diff.length <= max) return { text: diff, truncated: false };
  const cut = diff.lastIndexOf('\ndiff --git', max);
  const end = cut > 0 ? cut : max;
  return { text: diff.slice(0, end), truncated: true };
}

/** Drop lockfiles and generated noise before sending to the model. */
function filterNoise(diff) {
  const NOISE = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|pubspec\.lock|Podfile\.lock|\.min\.js|\.snap)$/;
  return diff
    .split(/(?=^diff --git )/m)
    .filter((chunk) => {
      const m = chunk.match(/^diff --git a\/(\S+)/);
      return !m || !NOISE.test(m[1]);
    })
    .join('');
}

function buildPrompt(rawDiff) {
  const { text, truncated } = truncateDiff(filterNoise(rawDiff));
  const system = [
    'You are a senior code reviewer.',
    'Review ONLY the diff. Focus on bugs, security, performance and missing tests.',
    'Do not comment on style unless it hides a bug.',
    'Reply with JSON only, matching this shape:',
    '{"summary": string, "risk": "high"|"medium"|"low",',
    ' "findings": [{"file": string, "line": number|null, "severity": "high"|"medium"|"low", "issue": string, "suggestion": string}],',
    ' "commitMessage": string}',
    'commitMessage must follow Conventional Commits, max 72 chars.',
  ].join('\n');
  const user = `${truncated ? '(Diff truncated to fit budget)\n' : ''}<diff>\n${text}\n</diff>`;
  return { system, user, truncated };
}

/** Parse model output defensively: strip code fences, validate shape. */
function parseReview(raw) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  let data;
  try {
    data = JSON.parse(cleaned);
  } catch {
    throw new Error('Model did not return valid JSON');
  }
  const errors = [];
  if (typeof data.summary !== 'string') errors.push('summary');
  if (!SEVERITIES.includes(data.risk)) errors.push('risk');
  if (!Array.isArray(data.findings)) errors.push('findings');
  if (typeof data.commitMessage !== 'string') errors.push('commitMessage');
  if (errors.length) throw new Error(`Invalid review fields: ${errors.join(', ')}`);

  data.findings = data.findings.filter((f) => f && typeof f.issue === 'string' && SEVERITIES.includes(f.severity));
  data.commitMessage = data.commitMessage.split('\n')[0].slice(0, 72);
  return data;
}

function toMarkdown(review) {
  const order = { high: 0, medium: 1, low: 2 };
  const rows = [...review.findings]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .map((f) => `| ${f.severity} | \`${f.file}${f.line ? `:${f.line}` : ''}\` | ${f.issue} | ${f.suggestion || ''} |`);
  return [
    `## AI review (risk: ${review.risk})`,
    '',
    review.summary,
    '',
    rows.length ? '| Severity | Where | Issue | Suggestion |\n|---|---|---|---|\n' + rows.join('\n') : '_No findings._',
    '',
    `**Suggested commit:** \`${review.commitMessage}\``,
  ].join('\n');
}

module.exports = { truncateDiff, filterNoise, buildPrompt, parseReview, toMarkdown, MAX_DIFF_CHARS };
