#!/usr/bin/env node
/**
 * Claude Code — PreToolUse + PostToolUse + Stop Hook (matcher: Task|Agent for
 * Pre/Post; Stop is unmatched, fires every turn): Task Diff Guard
 *
 * A dispatched subagent returns a NARRATIVE summary of what it did.
 * `model-routing.md` §Verification Tiering requires the orchestrator to verify the
 * ARTIFACT, never the summary — but nothing mechanically surfaces WHICH durable
 * artifacts a subagent touched.
 *
 * ── SGH-1b redesign (this file) — three coupled defects in the original
 * PreToolUse/PostToolUse-only design (`Artifacts/Plans/SGH-1-Plan.md` §SGH-1b §1):
 *
 *   D1 — Wrong settle trigger. `PostToolUse(Task|Agent)` diffed the live tree
 *        against ITS OWN snapshot while OTHER dispatches were still in flight,
 *        so a parallel dispatch's write got attributed to the wrong subagent
 *        (or missed entirely) — there is no beat at PostToolUse where "nothing
 *        else is in flight" is true.
 *   D2 — Unconditional delete. Both `doPre`'s `rmrf` (clearing "any stale
 *        snapshot under this key") and `doPost`'s `rmrf` (run before the
 *        early-return) assumed one-dispatch-per-key. Identical parallel
 *        dispatches (the SAME prompt fanned to N subagents — the designed
 *        `/audit --team` / `/afk` usage) collide on `sha1(tool_input)`,
 *        so one dispatch's cleanup silently destroyed another's baseline.
 *   D3 — Positives-only telemetry. `logGateSafe` was only called on the
 *        `changed.length > 0` branch, so a correct silent run wrote NOTHING —
 *        making "zero telemetry rows" ambiguous across "never armed" (the
 *        real 2026-09-04 failure), "armed and correctly silent", and "armed,
 *        fired, but the context never reached the orchestrator". A kill-if-
 *        silent exit condition instrumented only on the positive branch can
 *        never answer its own question.
 *
 * Fix — settle at Stop, not at PostToolUse:
 *
 *   PreToolUse(Task|Agent)   snapshot protected paths into a NEWLY CLAIMED
 *                            `<key>-<suffix>` dir (never `rmrf` an existing
 *                            one — D2) + write `manifest.json`
 *                            (`status: in-flight`).
 *   PostToolUse(Task|Agent)  stamp the OLDEST still-in-flight manifest sharing
 *                            this dispatch's key `returned_at`/`status:
 *                            returned`. NO diff, NO output, NO delete.
 *   Stop                     for every SETTLED (`status: returned`) manifest:
 *                            diff vs its snapshot, run the attribution filter
 *                            (drop a change the transcript shows the MAIN
 *                            AGENT itself made at/after dispatch — subagent
 *                            tool calls never appear in the parent transcript,
 *                            so what survives is subagent-attributed by
 *                            construction), aggregate every settled dispatch
 *                            into ONE `additionalContext` block, delete
 *                            settled snapshots only (in-flight ones are
 *                            retained across this Stop and re-evaluated at a
 *                            later one — the D2 regression guarantee), sweep
 *                            any manifest older than 6h regardless of status,
 *                            and log EXACTLY ONE gate-log row every time this
 *                            branch runs at all (`nag` if something surfaced,
 *                            `pass` otherwise, including a pure TTL sweep) —
 *                            fixing D3: `pass` is a liveness heartbeat, so
 *                            `pass == 0` now unambiguously means "dead", never
 *                            "silently fine".
 *
 * Attribution filter is timestamp-based, not `tool_use_id`-based: HR4
 * (`Artifacts/Plans/SGH-1-Plan.md` §7) forbids building on an unverified
 * runtime event/payload field. T8 probed whether the PreToolUse(Task|Agent)
 * stdin payload carries a stable `tool_use_id` and could NOT confirm it empirically
 * (no accessible schema for the compiled CLI binary; live telemetry showed this
 * guard has NEVER fired even once in this repo's own production history, so no
 * captured real payload was available either — see
 * `Artifacts/Temp/sgh1b_t8_probe.txt`). Every transcript entry DOES carry a
 * top-level ISO `timestamp` (confirmed by reading a real transcript file), and
 * `manifest.dispatched_at` is a `Date.now()` taken in the SAME wall-clock frame
 * — so attribution compares "was this main-agent edit's transcript timestamp
 * at-or-after this dispatch's `dispatched_at`", never a tool_use_id. Keying is
 * `sha1(tool_input)-<monotonic suffix>` (suffix claimed by directory creation,
 * so identical parallel dispatches never collide — the direct D2 fix) for the
 * same reason.
 *
 * Exit condition (BACKLOG `sgh1_task-diff-guard_exit_1`, two ordered gates):
 *   1. Liveness (blocking): `pass` rows > 0 across sessions that dispatched
 *      subagents. `pass == 0` means the guard is dead — fix the wiring, never
 *      delete the guard on that signal alone.
 *   2. Usefulness (only once #1 holds): `nag == 0` with `pass > 0` → guard is
 *      alive and found nothing → delete. `nag > 0` with true positives → keep.
 *      `nag > 0` all-noise → narrow `PROTECTED_FILES` or tighten attribution
 *      (`filtered_n` tells which).
 *
 * Feedback-only: `hookSpecificOutput.additionalContext`, NEVER a deny/block field or
 * exit 2 (LH-2-Plan.md Hard Rule 2, inherited — every hard-block variant either hangs
 * the session or blanks the final turn output).
 *
 * Fail-open: any error (bad stdin, unreadable snapshot/manifest, unreadable
 * transcript, fs failure) exits 0 with no output. Path resolution is
 * duplicated verbatim from audit-trail.js / gate-log.js (not imported) to keep
 * this a single self-contained file.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { parseTranscript, extractToolUses, getToolTargetPath } = require('./lib/evidence');

const SNAPSHOT_SUBDIR = path.join('.agent', 'pre-task-snapshot');
const MAX_FILE_BYTES = 256 * 1024;   // skip snapshotting anything larger
const MAX_SNAPSHOT_FILES = 200;      // hard ceiling on files copied per dispatch
const MAX_DIFF_LINES = 60;           // total, across every changed file, per Stop
const MAX_SUFFIX_ATTEMPTS = 200;     // ceiling on claiming a free `<key>-<n>` dir
const TTL_MS = 6 * 60 * 60 * 1000;   // 6h — a manifest older than this is swept regardless of status
const EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

// Protected artifacts, relative to the Artifacts/ dir. Explicit files plus
// shallow globs — a subagent editing any of these must be surfaced for
// artifact-level verification, not trusted on its summary.
//
// Deliberately NOT covering Evidence/ recursively: those files are committed,
// so tampering already shows in `git diff` and the nudge-handoff dirty-tree
// check, and snapshotting ~100 closed-phase blobs on every dispatch is
// disproportionate. The churn-heavy, nested-private-repo state files below are
// the actual blind spot (see BACKLOG sgh1_task-diff-guard_exit_1 for tuning).
const PROTECTED_FILES = [
  'BACKLOG.md',
  'TODO.md',
  'AUDIT_REPORT.md',
  'DECISION_LOG.md',
  'IMPLEMENTATION_PLAN.md',
];
const PROTECTED_GLOB_DIRS = [
  { dir: 'Plans', match: /\.md$/ },
  { dir: 'Reports', match: /\.md$/ },
];

function findProjectRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'Artifacts')) || fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

// Lazy-required and independently try/catch-wrapped so a bug in the logger can
// never crash this file before the additionalContext output is written.
function logGateSafe(params) {
  try {
    require('./lib/gate-log').logGateEvent(params);
  } catch {
    // Logging must never affect this hook's decision or exit code.
  }
}

function snapshotKey(toolInput) {
  const raw = JSON.stringify(toolInput === undefined ? null : toolInput);
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 12);
}

// Enumerate the protected files that currently exist, as paths relative to
// artifactsDir. Bounded by MAX_SNAPSHOT_FILES.
function listProtected(artifactsDir) {
  const out = [];
  const push = (rel) => {
    if (out.length >= MAX_SNAPSHOT_FILES) return;
    out.push(rel);
  };

  for (const rel of PROTECTED_FILES) {
    if (safeIsFile(path.join(artifactsDir, rel))) push(rel);
  }

  for (const { dir, match } of PROTECTED_GLOB_DIRS) {
    const abs = path.join(artifactsDir, dir);
    for (const name of safeReaddir(abs)) {
      if (match.test(name) && safeIsFile(path.join(abs, name))) push(path.join(dir, name));
    }
  }

  return out;
}

function walk(absDir, artifactsDir, push) {
  for (const name of safeReaddir(absDir)) {
    const abs = path.join(absDir, name);
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(abs, artifactsDir, push);
    } else if (stat.isFile()) {
      push(path.relative(artifactsDir, abs));
    }
  }
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function safeIsFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function safeRead(p) {
  try {
    if (fs.statSync(p).size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

function rmrf(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup — a leaked snapshot dir is harmless; the next TTL
    // sweep or a future run claims a fresh suffix regardless.
  }
}

// ── manifest I/O ─────────────────────────────────────────────────────────────
function readManifest(dir) {
  try {
    const raw = fs.readFileSync(path.join(dir, 'manifest.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null; // missing/corrupt manifest → legacy dir, TTL-swept only, never diffed
  }
}

function writeManifest(dir, manifest) {
  try {
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest), 'utf-8');
  } catch {
    // Best-effort — worst case this dir degrades to "legacy" and is TTL-swept.
  }
}

// Claim a NEW `<baseKey>-<n>` directory (D2 fix — never rmrf/reuse an existing
// one). `fs.mkdirSync` without `recursive` throws EEXIST if the exact dir
// already exists, which is the atomic-enough claim primitive Node offers.
function claimSnapshotDir(snapRoot, baseKey) {
  try {
    fs.mkdirSync(snapRoot, { recursive: true });
  } catch {
    return null;
  }
  for (let n = 0; n < MAX_SUFFIX_ATTEMPTS; n++) {
    const key = `${baseKey}-${n}`;
    const dir = path.join(snapRoot, key);
    try {
      fs.mkdirSync(dir);
      return { key, dir };
    } catch (err) {
      if (err && err.code === 'EEXIST') continue;
      return null; // some other fs error — fail open
    }
  }
  return null; // exhausted suffixes — fail open; this dispatch goes unguarded
}

// The OLDEST still-in-flight manifest sharing this dispatch's base key. With
// N identical parallel dispatches, each PostToolUse consumes exactly one
// remaining in-flight dir (the earliest by dispatched_at); which specific
// dispatch's Post claims which specific dir is arbitrary, but since a true
// collision means near-simultaneous PreToolUse calls, all such dirs share the
// same pre-write baseline — so any pairing yields a correct diff at Stop.
function findOldestInFlightMatchingKey(snapRoot, toolInput) {
  const prefix = `${snapshotKey(toolInput)}-`;
  let best = null;
  for (const name of safeReaddir(snapRoot)) {
    if (!name.startsWith(prefix)) continue;
    const dir = path.join(snapRoot, name);
    const manifest = readManifest(dir);
    if (!manifest || manifest.status !== 'in-flight') continue;
    const dispatchedAt = typeof manifest.dispatched_at === 'number' ? manifest.dispatched_at : 0;
    if (!best || dispatchedAt < best.dispatchedAt) {
      best = { dir, dispatchedAt };
    }
  }
  return best ? best.dir : null;
}

function isDirStale(dir, nowMs) {
  try {
    return (nowMs - fs.statSync(dir).mtimeMs) > TTL_MS;
  } catch {
    return false;
  }
}

// ── PreToolUse ────────────────────────────────────────────────────────────────
function doPre(data) {
  const cwd = data.cwd || process.cwd();
  const root = findProjectRoot(cwd);
  const artifactsDir = path.join(root, 'Artifacts');
  if (!fs.existsSync(artifactsDir)) return;

  const snapRoot = path.join(artifactsDir, SNAPSHOT_SUBDIR);
  const claimed = claimSnapshotDir(snapRoot, snapshotKey(data.tool_input));
  if (!claimed) return; // fail open — this dispatch goes unguarded rather than clobbering another's baseline

  for (const rel of listProtected(artifactsDir)) {
    const content = safeRead(path.join(artifactsDir, rel));
    if (content === null) continue;
    const dest = path.join(claimed.dir, rel);
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content, 'utf-8');
    } catch {
      // Skip this file — a partial snapshot still catches the other files.
    }
  }

  const toolInput = data.tool_input || {};
  writeManifest(claimed.dir, {
    key: claimed.key,
    tool_use_id: null, // T8 (Artifacts/Temp/sgh1b_t8_probe.txt): unverifiable from this payload — HR4. Reserved for v2.
    subagent_type: toolInput.subagent_type || null,
    description: toolInput.description || null,
    dispatched_at: Date.now(),
    returned_at: null,
    status: 'in-flight',
  });
}

// ── PostToolUse ───────────────────────────────────────────────────────────────
// Stamp-only (D1 fix): no diff, no output, no delete. Settling happens at Stop,
// the only beat where "nothing else is in flight" can be evaluated per-dispatch.
function doPost(data) {
  const cwd = data.cwd || process.cwd();
  const root = findProjectRoot(cwd);
  const artifactsDir = path.join(root, 'Artifacts');
  if (!fs.existsSync(artifactsDir)) return;

  const snapRoot = path.join(artifactsDir, SNAPSHOT_SUBDIR);
  const dir = findOldestInFlightMatchingKey(snapRoot, data.tool_input);
  if (!dir) return; // no matching in-flight snapshot → nothing to stamp, stay silent

  const manifest = readManifest(dir);
  if (!manifest) return; // legacy/corrupt → leave for the Stop TTL sweep

  manifest.returned_at = Date.now();
  manifest.status = 'returned';
  writeManifest(dir, manifest);
}

// ── Stop ──────────────────────────────────────────────────────────────────────
function readTranscript(transcriptPath) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return '';
    return fs.readFileSync(transcriptPath, 'utf-8');
  } catch {
    return '';
  }
}

function entryTimestampMs(entry) {
  const t = entry && entry.timestamp;
  if (typeof t !== 'string') return null;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : ms;
}

function normalizeRelPath(p) {
  return String(p).replace(/\\/g, '/').toLowerCase();
}

// Every path the MAIN AGENT itself edited at-or-after `sinceMs` (a manifest's
// dispatched_at). Subagent tool calls never appear in the parent transcript,
// so this set is exactly "what the orchestrator touched", never the subagent.
function mainAgentEditedPathsAtOrAfter(entries, sinceMs) {
  const paths = [];
  for (const use of extractToolUses(entries)) {
    if (!EDIT_TOOL_NAMES.has(use.name)) continue;
    const ts = entryTimestampMs(entries[use.entryIndex]);
    if (ts === null || ts < sinceMs) continue;
    const target = getToolTargetPath(use);
    if (target) paths.push(normalizeRelPath(target));
  }
  return paths;
}

// Drops a changed protected file if the transcript shows the MAIN AGENT (not
// the subagent) edited that same path at-or-after this dispatch. Fail-open
// direction is deliberate: an unreadable transcript, or a dispatch with no
// usable `dispatched_at`, filters NOTHING (surface everything) — the guard's
// failure mode must be a redundant nag, never a swallowed finding.
function filterAttribution(entries, dispatchedAt, changed) {
  if (!entries || entries.length === 0) return { surfaced: changed, filteredCount: 0 };
  if (typeof dispatchedAt !== 'number') return { surfaced: changed, filteredCount: 0 };

  const mainAgentPaths = mainAgentEditedPathsAtOrAfter(entries, dispatchedAt);
  if (mainAgentPaths.length === 0) return { surfaced: changed, filteredCount: 0 };

  const surfaced = [];
  let filteredCount = 0;
  for (const c of changed) {
    const target = normalizeRelPath(`artifacts/${c.rel.split(path.sep).join('/')}`);
    const isMainAgentEdit = mainAgentPaths.some((p) => p === target || p.endsWith(`/${target}`) || p.endsWith(target));
    if (isMainAgentEdit) filteredCount++;
    else surfaced.push(c);
  }
  return { surfaced, filteredCount };
}

// `manifest.json` lives inside the snapshot dir alongside the copied protected
// files — exclude it, it is not itself a protected artifact.
function listSnapshotFiles(snapDir) {
  const out = [];
  walk(snapDir, snapDir, (rel) => {
    if (rel !== 'manifest.json') out.push(rel);
  });
  return out;
}

function diffSnapshotAgainstLive(snapDir, artifactsDir) {
  const changed = [];
  for (const rel of listSnapshotFiles(snapDir)) {
    const before = safeRead(path.join(snapDir, rel));
    const after = safeRead(path.join(artifactsDir, rel));
    if (before === null) continue;
    if (before !== (after === null ? null : after)) {
      changed.push({ rel, before, after });
    }
  }
  return changed;
}

function doStop(data) {
  if (data.stop_hook_active) return; // already mid-retry-chain — stay silent

  const cwd = data.cwd || process.cwd();
  const root = findProjectRoot(cwd);
  const artifactsDir = path.join(root, 'Artifacts');
  if (!fs.existsSync(artifactsDir)) return;

  const snapRoot = path.join(artifactsDir, SNAPSHOT_SUBDIR);
  const dirNames = safeReaddir(snapRoot);
  if (dirNames.length === 0) return; // nothing pending → no row (silence = "no subagents this turn")

  const entries = parseTranscript(readTranscript(data.transcript_path));
  const nowMs = Date.now();

  let settledCount = 0;
  let ttlSweptCount = 0;
  let totalFilteredN = 0;
  const settledResults = [];

  for (const name of dirNames) {
    const dir = path.join(snapRoot, name);
    const manifest = readManifest(dir);

    if (!manifest) {
      if (isDirStale(dir, nowMs)) {
        rmrf(dir);
        ttlSweptCount++;
      }
      continue; // legacy/corrupt, not yet stale → leave alone, never diffed
    }

    const dispatchedAt = typeof manifest.dispatched_at === 'number' ? manifest.dispatched_at : 0;
    if (nowMs - dispatchedAt > TTL_MS) {
      rmrf(dir); // TTL sweep applies regardless of status — a crashed/abandoned dispatch must not leak forever
      ttlSweptCount++;
      continue;
    }

    if (manifest.status !== 'returned') continue; // retain in-flight — D2 regression guarantee

    settledCount++;
    const changed = diffSnapshotAgainstLive(dir, artifactsDir);
    if (changed.length > 0) {
      const { surfaced, filteredCount } = filterAttribution(entries, dispatchedAt, changed);
      totalFilteredN += filteredCount;
      if (surfaced.length > 0) {
        settledResults.push({
          subagent: manifest.subagent_type || manifest.description || 'a subagent',
          changed: surfaced,
        });
      }
    }
    rmrf(dir); // settled → always deleted, surfaced or not
  }

  if (settledCount === 0 && ttlSweptCount === 0) return; // nothing evaluated at all → no row

  if (settledResults.length > 0) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: buildAggregateMessage(settledResults),
      },
    }));
    logGateSafe({
      hook: 'task-diff-guard',
      event: 'Stop',
      decision: 'nag',
      tool: null,
      ruleId: 'task-diff-guard',
      cwd,
      filtered_n: totalFilteredN,
      settled_n: settledCount,
    });
    return;
  }

  // Correctly silent this Stop — still logged (D3 fix: this is the liveness
  // heartbeat the exit condition needs). A pure TTL sweep with zero settled
  // dispatches is also a `pass`, annotated so leakage is measurable.
  logGateSafe({
    hook: 'task-diff-guard',
    event: 'Stop',
    decision: 'pass',
    tool: null,
    ruleId: 'task-diff-guard',
    cwd,
    filtered_n: totalFilteredN,
    settled_n: settledCount,
    ...(settledCount === 0 && ttlSweptCount > 0 ? { note: 'ttl' } : {}),
  });
}

function buildAggregateMessage(results) {
  const totalFiles = results.reduce((sum, r) => sum + r.changed.length, 0);
  const subagents = results.map((r) => r.subagent);
  const header =
    `TASK DIFF GUARD: ${results.length} settled subagent dispatch(es) modified ${totalFiles} ` +
    `protected artifact(s) this turn (${subagents.join(', ')}). Per model-routing.md ` +
    `§Verification Tiering, verify these edits against the raw file — do not accept the ` +
    `subagent's summary as proof. Changes below (capped ${MAX_DIFF_LINES} lines total):`;

  const lines = [];
  let budget = MAX_DIFF_LINES;
  outer: for (const r of results) {
    for (const c of r.changed) {
      if (budget <= 0) break outer;
      lines.push('', `── [${r.subagent}] Artifacts/${c.rel.split(path.sep).join('/')} ──`);
      if (c.after === null) {
        lines.push('  (file deleted or unreadable after the dispatch)');
        budget -= 3;
        continue;
      }
      const hunk = miniDiff(c.before, c.after, budget);
      lines.push(...hunk.lines);
      budget -= hunk.lines.length + 2;
    }
  }

  return `${header}\n${lines.join('\n')}`;
}

// Compact diff: trim the common prefix/suffix of lines, show the differing middle
// as `- old` / `+ new`. Not a full Myers diff — enough to point a reader at what
// moved so they open the real file. `cap` bounds the emitted line count.
function miniDiff(before, after, cap) {
  const a = before.split('\n');
  const b = after.split('\n');

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const removed = a.slice(start, endA);
  const added = b.slice(start, endB);
  const lines = [`  @@ line ~${start + 1} @@`];

  for (const r of removed) {
    if (lines.length >= cap) { lines.push('  … (truncated)'); return { lines }; }
    lines.push(`  - ${r}`);
  }
  for (const ad of added) {
    if (lines.length >= cap) { lines.push('  … (truncated)'); return { lines }; }
    lines.push(`  + ${ad}`);
  }
  return { lines };
}

// ── entry ────────────────────────────────────────────────────────────────────
function main() {
  try {
    let input = '';
    try {
      input = fs.readFileSync(0, 'utf-8');
    } catch {
      process.exit(0);
    }

    let data;
    try {
      data = JSON.parse(input);
    } catch {
      process.exit(0);
    }

    const event = data.hook_event_name || '';

    // Stop is unmatched in settings-template.json (fires every turn, like the
    // other three Stop hooks) — it is NOT gated on tool_name.
    if (event === 'Stop') {
      doStop(data);
      process.exit(0);
    }

    // Pre/Post only act on the subagent-dispatch tool. This runtime names it
    // 'Agent'; other/older runtimes name it 'Task' — accept both. The matcher
    // in settings-template.json already scopes this, but a mis-wire must not
    // make the hook touch other tools.
    const toolName = data.tool_name || '';
    if (toolName !== 'Task' && toolName !== 'Agent') {
      process.exit(0);
    }

    if (event === 'PreToolUse') {
      doPre(data);
    } else if (event === 'PostToolUse') {
      doPost(data);
    }
    // Unknown event → no-op, exit 0.

    process.exit(0);
  } catch (err) {
    process.stderr.write(`[claude-code/task-diff-guard] Error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
