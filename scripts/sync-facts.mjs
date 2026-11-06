// Read-only, bounded inventory for the main-session /sync workflow.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MAX_SCAN = 8 * 1024 * 1024;
const MAX_OUTPUT = 6000;
const stateFiles = ['TODO.md', 'IMPLEMENTATION_PLAN.md', '.agent/current_task.md', 'DECISION_LOG.md', 'BACKLOG.md', 'learnings/HOT.md'];
const args = process.argv.slice(2);
let root = process.cwd();
if (args.length) {
  if (args.length !== 2 || args[0] !== '--root' || !path.isAbsolute(args[1])) {
    console.error('Invalid arguments: expected --root <absolute directory>');
    process.exit(2);
  }
  root = args[1];
}
try {
  if (!fs.statSync(root).isDirectory()) throw new Error('not a directory');
} catch {
  console.error('Invalid root: expected an existing directory');
  process.exit(2);
}
root = path.resolve(root);
const artifacts = path.join(root, 'Artifacts');
const lines = [];
const add = line => lines.push(line);
const section = name => add(`\n${name}`);
const oneLine = text => text.replace(/[\r\n\x00-\x1f\x7f]/g, ' ').trim();
function clipBytes(text, limit) {
  const bytes = Buffer.from(text);
  if (bytes.length <= limit) return text;
  // Decode only complete UTF-8 characters, leaving room for the replacement marker.
  let end = limit;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString('utf8');
}
function readBounded(file, limit = MAX_SCAN) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) return { error: 'not a regular file' };
    if (stat.size > limit) return { error: 'too large to scan' };
    const buffer = Buffer.alloc(stat.size + 1);
    const size = fs.readSync(fd, buffer, 0, buffer.length, 0);
    if (size > limit) return { error: 'too large to scan' };
    return { text: buffer.subarray(0, size).toString('utf8') };
  } catch (error) {
    return { error: error.code === 'ENOENT' ? 'absent' : 'unreadable' };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
function git(cwd, ...argv) {
  const result = spawnSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '--no-pager', ...argv], {
    cwd, encoding: 'utf8', timeout: 5000, maxBuffer: 65536,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat' },
  });
  return result.status === 0 ? result.stdout.trim() : null;
}
function gitFacts(cwd) {
  const branch = git(cwd, 'status', '--short', '--branch');
  if (branch === null) { add('git status unavailable'); return; }
  const [branchLine, ...paths] = branch.split(/\r?\n/);
  add(`status: ${clipBytes(oneLine(branchLine), 240)}`);
  const untracked = paths.filter(p => p.startsWith('??')).length;
  add(`changed paths: ${paths.length} (untracked ${untracked})`);
  for (const p of paths.slice(0, 15)) add(`  ${clipBytes(oneLine(p), 120)}`);
  if (paths.length > 15) add(`  ... +${paths.length - 15} more`);
  const head = git(cwd, 'log', '-1', '--format=%h %cs %s');
  const previous = git(cwd, 'log', '-1', '--format=%h %cs %s', 'HEAD~1');
  add(`HEAD: ${head === null ? 'unavailable' : clipBytes(oneLine(head), 180)}`);
  add(`HEAD~1: ${previous === null ? 'unavailable' : clipBytes(oneLine(previous), 180)}`);
}
section('PROJECT');
add(`root: ${clipBytes(oneLine(root), 240)}`);
section('GIT');
gitFacts(root);
if (fs.existsSync(path.join(artifacts, '.git'))) {
  section('ARTIFACTS REPO');
  gitFacts(artifacts);
}
section('STATE FILES');
for (const rel of stateFiles) {
  try {
    const stat = fs.statSync(path.join(artifacts, rel));
    add(`${rel}: ${stat.size} bytes, mtime ${stat.mtime.toISOString()}`);
  } catch (error) {
    add(`${rel}: ${error.code === 'ENOENT' ? 'absent' : 'unreadable'}`);
  }
}
const current = readBounded(path.join(artifacts, '.agent/current_task.md'));
section('CURRENT_TASK');
let currentIndex = null;
if (current.error) add(current.error);
else {
  currentIndex = lines.length;
  add(clipBytes(current.text, 2000).trimEnd());
  if (Buffer.byteLength(current.text) > 2000) add('[current task truncated]');
}
section('DECISION_LOG newest');
const decision = readBounded(path.join(artifacts, 'DECISION_LOG.md'));
if (decision.error) add(decision.error);
else {
  const match = /^## .*(?:\r?\n|$)/m.exec(decision.text);
  if (!match) add('no level-2 heading found');
  else {
    const start = match.index;
    const next = /^## /m.exec(decision.text.slice(start + match[0].length));
    const end = next ? start + match[0].length + next.index : decision.text.length;
    const entry = decision.text.slice(start, end).trimEnd();
    add(clipBytes(entry, 600));
    if (Buffer.byteLength(entry) > 600) add('[decision truncated]');
  }
}
section('BACKLOG');
const backlog = readBounded(path.join(artifacts, 'BACKLOG.md'));
if (backlog.error) add(backlog.error);
else {
  const counts = { OPEN: 0, RESOLVED: 0, other: 0 };
  const open = [];
  const words = new Map();
  let nonRegistry = 0, missingStatus = 0, entry = null;
  for (const line of backlog.text.split(/\r?\n/)) {
    if (/^## /.test(line)) {
      if (entry && !entry.seen) missingStatus++;
      const heading = /^## `([^`]+)` (.*)$/.exec(line);
      if (heading) entry = { id: heading[1], title: heading[2], seen: false };
      else { nonRegistry++; entry = null; }
    }
    const word = /\bStatus:\s*\**\s*([A-Za-z][A-Za-z0-9_-]*)/i.exec(line);
    if (word) {
      const status = word[1].toUpperCase();
      words.set(status, (words.get(status) ?? 0) + 1);
    }
    const statusLine = /^\*\*Status:\*\*\s*(\S+)/i.exec(line);
    if (entry && !entry.seen && statusLine) {
      entry.seen = true;
      const status = statusLine[1].toUpperCase();
      if (status === 'OPEN') {
        counts.OPEN++;
        if (open.length < 5) open.push(`${clipBytes(oneLine(entry.id), 80)}: ${Array.from(oneLine(entry.title)).slice(0, 80).join('')}`);
      } else if (status === 'RESOLVED') counts.RESOLVED++;
      else counts.other++;
    }
  }
  if (entry && !entry.seen) missingStatus++;
  add(`OPEN: ${counts.OPEN} RESOLVED: ${counts.RESOLVED} other: ${counts.other}`);
  for (const item of open) add(`OPEN ${item}`);
  add(`headings not in registry format: ${nonRegistry}${nonRegistry ? ' (unparsed)' : ''}`);
  if (missingStatus) add(`registry entries without status: ${missingStatus} (unparsed)`);
  add(`status-word tally: ${[...words].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6).map(([word, count]) => `${clipBytes(word, 60)} ${count}`).join(', ') || 'none'}`);
}
section('MARKERS');
const plans = current.text ? [...new Set(current.text.match(/Plans\/[A-Za-z0-9._-]+\.md\b/g) ?? [])].filter(rel => {
  try { return fs.statSync(path.join(artifacts, rel)).isFile(); } catch { return false; }
}).slice(0, 3) : [];
const localChecker = path.join(root, 'scripts', 'check-markers.mjs');
const retainedChecker = path.join(os.homedir(), '.pi', 'agent', 'pi-retained', 'scripts', 'check-markers.mjs');
const checker = fs.existsSync(localChecker) ? localChecker : fs.existsSync(retainedChecker) ? retainedChecker : null;
if (!plans.length) add(current.error ? 'unknown: current task unavailable' : 'no existing named plans');
else if (!checker) add('checker unavailable');
else for (const rel of plans) {
  const result = spawnSync(process.execPath, [checker, path.join(artifacts, rel), '--root', root, '--strict'], { cwd: root, encoding: 'utf8', timeout: 10000, maxBuffer: 65536 });
  const summary = (result.stdout ?? '').split(/\r?\n/).find(line => line.startsWith('summary '));
  add(`${rel}: ${summary ? clipBytes(oneLine(summary), 240) : 'summary unavailable'}; exit ${result.status ?? 'unavailable'}`);
}
let output = `${lines.join('\n').trimStart()}\n`;
if (Buffer.byteLength(output) <= MAX_OUTPUT) process.stdout.write(output);
else {
  const suffix = '\n[truncated]\n';
  // Prefer shortening the task excerpt to losing the backlog and marker sections entirely.
  if (currentIndex !== null) {
    const note = '\n[current task truncated]';
    const excess = Buffer.byteLength(output) + Buffer.byteLength(suffix) - MAX_OUTPUT;
    const available = Math.max(0, Buffer.byteLength(lines[currentIndex]) - excess - Buffer.byteLength(note));
    lines[currentIndex] = clipBytes(lines[currentIndex], available).trimEnd() + note;
    output = `${lines.join('\n').trimStart()}\n`;
  }
  process.stdout.write(clipBytes(output, MAX_OUTPUT - Buffer.byteLength(suffix)).trimEnd() + suffix);
}
