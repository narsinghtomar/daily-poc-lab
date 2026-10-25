#!/usr/bin/env node
'use strict';

/**
 * POC Lab helper. Zero dependencies.
 *
 *   node scripts/lab.js today            what to build today (from plan/plan.json)
 *   node scripts/lab.js start [--week N] scaffold this week's POC folder
 *   node scripts/lab.js ship ["msg"]     log + commit + push today's real work
 *        [--no-push]
 *   node scripts/lab.js index            rebuild the POC table in README.md
 *   node scripts/lab.js check [--notify] did I commit today? (used by the reminder)
 *
 * Rules baked in: no empty commits, no backdating. `ship` refuses unless
 * you actually changed files today.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PLAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan', 'plan.json'), 'utf8'));
const DAY_MS = 86_400_000;

const sh = (cmd, opts = {}) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
const localDate = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local TZ
const toUTC = (ymd) => Date.UTC(...ymd.split('-').map((n, i) => (i === 1 ? +n - 1 : +n)));
const pocDir = (w) => path.join(ROOT, 'pocs', `${w.id}-${w.slug}`);
const scopeOf = (w) => `poc-${w.id}`;

function position(dateStr = localDate()) {
  const idx = Math.floor((toUTC(dateStr) - toUTC(PLAN.startDate)) / DAY_MS);
  if (idx < 0) return { before: true, daysLeft: -idx };
  const weekIdx = Math.floor(idx / 7);
  const dow = idx % 7;
  if (weekIdx >= PLAN.weeks.length) return { finished: true };
  const week = PLAN.weeks[weekIdx];
  const task = dow < 6 ? week.days[dow] : 'Weekly review in DEVLOG.md (what worked, what I would change, interview talking points)';
  return { weekNo: weekIdx + 1, dow, dayLabel: PLAN.dayLabels[dow], week, task };
}

function committedToday() {
  try {
    const out = sh(`git log --since="${localDate()} 00:00" --oneline`);
    return out ? out.split('\n').length : 0;
  } catch {
    return 0;
  }
}

function cmdToday() {
  const p = position();
  if (p.before) return console.log(`Plan starts ${PLAN.startDate} (${p.daysLeft} day(s) from now). Use the time to polish POC 001/002.`);
  if (p.finished) return console.log('Plan complete. Add new weeks to plan/plan.json.');
  const dir = pocDir(p.week);
  const n = committedToday();
  console.log(`
Week ${p.weekNo} · ${p.dayLabel} · ${p.week.stack}
POC ${p.week.id}: ${p.week.title}
Folder: pocs/${p.week.id}-${p.week.slug} ${fs.existsSync(dir) ? '' : '(not created yet: run `yarn start-week`)'}

Today's milestone:
  ${p.task}

Commits today: ${n}${n ? ' ✓' : ''}
When done:  yarn ship
`);
}

const README_TEMPLATE = (w, weekNo) => `# ${w.id} · ${w.title}

**Stack:** ${w.stack} · **Week:** ${weekNo} · **Status:** in progress

## Problem
<!-- 2-3 lines: what real problem does this solve? -->

## What this POC shows
-

## Run
\`\`\`bash
# fill in as you build
\`\`\`

## What I'd do in production
-

## Interview talking points
-

## Daily plan
${w.days.map((d, i) => `- [ ] ${PLAN.dayLabels[i]}: ${d}`).join('\n')}
- [ ] Sun: weekly review in DEVLOG.md
`;

function cmdStart(args) {
  const wi = args.indexOf('--week');
  let weekNo;
  if (wi >= 0) weekNo = Number(args[wi + 1]);
  else {
    const p = position();
    if (p.before) weekNo = 1;
    else if (p.finished) return console.log('Plan complete. Add weeks to plan/plan.json.');
    else weekNo = p.weekNo;
  }
  const w = PLAN.weeks[weekNo - 1];
  if (!w) return console.error(`No week ${weekNo} in plan.`);
  const dir = pocDir(w);
  if (fs.existsSync(dir)) return console.log(`Already exists: pocs/${w.id}-${w.slug}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), README_TEMPLATE(w, weekNo));
  fs.writeFileSync(path.join(dir, 'DEVLOG.md'), `# Devlog · ${w.id}\n\n`);
  cmdIndex(true);
  console.log(`Created pocs/${w.id}-${w.slug}\n\nNext:\n  cd pocs/${w.id}-${w.slug}\n  ${w.init}\n\nThen build today's milestone and run: yarn ship`);
}

function cmdShip(args) {
  const noPush = args.includes('--no-push');
  const msgArg = args.find((a) => !a.startsWith('--'));
  const p = position();
  const week = p.week;

  const changes = sh('git status --porcelain');
  if (!changes) {
    console.error('Nothing changed. Build something first: there are no empty commits in this lab.');
    process.exit(1);
  }

  let msg = msgArg || p.task;
  if (!msg) {
    console.error('No message given and no planned task for today. Usage: yarn ship "Add retry to sync queue"');
    process.exit(1);
  }
  // Plain messages only: drop any 'type(scope):' prefix and capitalize.
  msg = msg.replace(/^\w+(\([^)]*\))?!?:\s*/, '');
  msg = msg.charAt(0).toUpperCase() + msg.slice(1);

  if (week && fs.existsSync(pocDir(week))) {
    const log = path.join(pocDir(week), 'DEVLOG.md');
    fs.appendFileSync(log, `- ${localDate()} (W${p.weekNo} ${p.dayLabel}): ${msg}\n`);
  }
  cmdIndex(true);

  sh('git add -A');
  const body = `${msg}\n`;
  execSync('git commit -F -', { cwd: ROOT, input: body, stdio: ['pipe', 'inherit', 'inherit'] });
  if (!noPush) {
    try {
      execSync('git push', { cwd: ROOT, stdio: 'inherit' });
    } catch {
      console.error('\nCommitted locally but push failed. Check your remote, then run: git push');
      process.exit(1);
    }
  }
  console.log(`\nShipped: ${msg}`);
}

function cmdIndex(quiet) {
  const today = localDate();
  const rows = [
    '| # | POC | Stack | Status |',
    '|---|---|---|---|',
    '| 001 | [Node.js rate limiter](pocs/001-node-rate-limiter) | Node.js | Done |',
    '| 002 | [AI diff reviewer](pocs/002-ai-diff-reviewer) | Node.js + AI | Done |',
  ];
  PLAN.weeks.forEach((w, i) => {
    const exists = fs.existsSync(pocDir(w));
    const weekEnd = new Date(toUTC(PLAN.startDate) + (i * 7 + 6) * DAY_MS).toISOString().slice(0, 10);
    const status = !exists ? `Planned (week ${i + 1})` : today > weekEnd ? 'Done' : 'In progress';
    const name = exists ? `[${w.title}](pocs/${w.id}-${w.slug})` : w.title;
    rows.push(`| ${w.id} | ${name} | ${w.stack} | ${status} |`);
  });
  const readmePath = path.join(ROOT, 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');
  const updated = readme.replace(/<!-- POC_INDEX_START -->[\s\S]*<!-- POC_INDEX_END -->/, `<!-- POC_INDEX_START -->\n${rows.join('\n')}\n<!-- POC_INDEX_END -->`);
  fs.writeFileSync(readmePath, updated);
  if (!quiet) console.log('README index updated.');
}

function cmdCheck(args) {
  const n = committedToday();
  const msg = n ? `${n} commit(s) today. Nice.` : "No commit yet today. Even 20 minutes on today's milestone counts.";
  console.log(msg);
  if (!n && args.includes('--notify') && process.platform === 'darwin') {
    const p = position();
    const detail = p.task ? p.task.replace(/"/g, "'") : 'Open the lab';
    try {
      execSync(`osascript -e 'display notification "${detail}" with title "POC Lab: no commit yet today"'`);
    } catch {}
  }
}

const [cmd, ...args] = process.argv.slice(2);
const commands = { today: cmdToday, start: cmdStart, ship: cmdShip, index: () => cmdIndex(false), check: cmdCheck };
if (!commands[cmd]) {
  console.log('Commands: today | start [--week N] | ship ["msg"] [--no-push] | index | check [--notify]');
  process.exit(cmd ? 1 : 0);
}
commands[cmd](args);

module.exports = { position };
