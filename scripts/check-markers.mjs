// PI-8 T3: read-only check that every `[x]` in a phase TODO carries a valid auditor-verified suffix.
// Historical `[x]` lines without a suffix are `legacy` (a failure only under --strict). This tool
// detects an unverified or stale marker after the fact; it does not prevent a hand edit, and it
// cannot prove who authored a result file. It never modifies anything.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { verifyVerdictFile } from '../pi/lib/verdict.mjs';
import { parseTodo } from '../pi/lib/todo-ownership.mjs';
const SUFFIX = / — Auditor-(verified|reviewed) (\d{4}-\d{2}-\d{2}) \((PASS|FAIL); verdict=([A-Za-z0-9._-]{1,80}); sha256=([0-9a-f]{64})\)$/;
const RESULTS = ['Artifacts', '.agent', 'pi-results'];

function classify({ root, rel, id, marker, line }) {
  const suffix = SUFFIX.exec(line);
  const claims = line.includes(' — Auditor-');
  if (!suffix) return claims ? ['invalid', 'malformed review suffix'] : marker === 'x' || marker === 'X' ? ['legacy', 'no verification suffix'] : null;
  const [, kind, date, expected, dispatch, sha] = suffix;
  if (!((marker === 'x' && kind === 'verified' && expected === 'PASS') || (marker === ' ' && kind === 'reviewed' && expected === 'FAIL'))) return ['invalid', 'marker and review suffix disagree'];
  const d = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date) return ['invalid', 'invalid review date'];
  if (dispatch === '.' || dispatch === '..') return ['invalid', 'bad verdict reference'];
  const ref = path.join(root, ...RESULTS, `${dispatch}.result`);
  let stat;
  try { stat = fs.lstatSync(ref); } catch (error) {
    return error.code === 'ENOENT' ? ['missing-file', `no result file for ${dispatch}`] : ['invalid', error.message];
  }
  if (!stat.isFile() || stat.isSymbolicLink()) return ['invalid', 'result is not a regular file'];
  if (createHash('sha256').update(fs.readFileSync(ref)).digest('hex') !== sha) return ['hash-mismatch', 'result file differs from the recorded sha256'];
  try {
    const v = verifyVerdictFile({ ref, expected: { task: id, todo: rel, taskLine: line } });
    if (v.verdict !== expected) return ['invalid', `verdict is ${v.verdict}`];
    return [expected === 'PASS' ? 'valid' : 'reviewed', v.evidence];
  } catch (error) {
    return [/^stale task/.test(error.message) ? 'stale-task' : 'invalid', error.message];
  }
}

export function checkMarkers({ root, todos, strict = false }) {
  if (!Array.isArray(todos) || todos.length === 0) throw new Error('at least one todo path required');
  const rootReal = fs.realpathSync(root);
  const findings = [];
  for (const todo of todos) {
    const stat = fs.lstatSync(todo);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${todo}: not a regular file`);
    const rel = path.relative(rootReal, fs.realpathSync(todo)).split(path.sep).join('/');
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`${todo}: outside the project`);
    if (rel.toLowerCase() === 'artifacts/todo.md') throw new Error(`${todo}: top-level TODO is not eligible (phase TODOs only)`);
    const parsed = parseTodo(fs.readFileSync(todo));
    if (!parsed.eligible) {
      findings.push({ todo: rel, line: 0, task: '-', status: 'ineligible', reason: parsed.errors.join('; ') });
      continue;
    }
    for (const t of parsed.tasks) {
      const line = parsed.lines[t.lineIndex].text;
      const result = classify({ root: rootReal, rel, id: t.id, marker: t.marker, line });
      if (result) findings.push({ todo: rel, line: t.lineIndex + 1, task: t.id, status: result[0], reason: result[1] });
    }
  }
  const counts = {};
  for (const f of findings) counts[f.status] = (counts[f.status] ?? 0) + 1;
  const bad = findings.some(f => !['valid', 'reviewed'].includes(f.status) && (f.status !== 'legacy' || strict));
  return { findings, counts, exit: bad ? 1 : 0 };
}

function usage(why) {
  console.error(`${why}\nusage: node scripts/check-markers.mjs <todo>... [--root dir] [--strict]`);
  return 2;
}

function cli(argv) {
  const todos = []; let strict = false; let root = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') strict = true;
    else if (a === '--root' && argv[i + 1]) root = argv[++i];
    else if (a.startsWith('--')) return usage(`unknown option ${a}`);
    else todos.push(path.resolve(a));
  }
  if (todos.length === 0) return usage('expected at least one <todo>');
  try {
    const out = checkMarkers({ root, todos, strict });
    for (const f of out.findings) console.log(`${f.status} ${f.todo}:${f.line} ${f.task} ${f.reason}`);
    console.log(`summary ${JSON.stringify(out.counts)} exit=${out.exit}`);
    return out.exit;
  } catch (error) { console.error(`ERROR: ${error.message}`); return 2; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = cli(process.argv.slice(2));
