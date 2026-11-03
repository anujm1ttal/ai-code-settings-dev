// PI-8 T2: mark one phase-TODO task `[x]` only from a verified auditor PASS. Dry run by default.
// Changes exactly one marker character and one review suffix; preserves BOM, line endings and the
// final newline. A TOCTOU window remains between the last re-read and the rename; this is a
// discipline aid, not an OS boundary, and cannot prove who authored the result file.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { verifyVerdictFile, stripReviewSuffix } from '../pi/lib/verdict.mjs';

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FENCE = /^\s{0,3}(```|~~~)/;
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function markVerified({ root, todo, taskId, resultRef, apply = false, acceptUncorroborated = false, today = localDate(), _beforeWrite }) {
  if (typeof taskId !== 'string' || !/^[A-Za-z0-9._-]{1,40}$/.test(taskId)) throw new Error('invalid task id');
  const stat = fs.lstatSync(todo);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('todo is not a regular file (link refused)');
  const rootReal = fs.realpathSync(root);
  const rel = path.relative(rootReal, fs.realpathSync(todo)).split(path.sep).join('/');
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('todo is outside the project');
  if (rel.toLowerCase() === 'artifacts/todo.md') throw new Error('top-level TODO is not eligible (phase TODOs only)');

  const original = fs.readFileSync(todo);
  const parts = original.toString('utf8').split(/(\r\n|\n|\r)/); // even = line, odd = terminator
  const strict = new RegExp(`^\\s*- \\[([ xX\\-])\\] (?:\\[[^\\]]*\\] )?${escape(taskId)}:`);
  const loose = new RegExp(`- \\[[ xX\\-]\\] (?:\\[[^\\]]*\\] )?${escape(taskId)}:`);
  let fenced = false, total = 0, hit = -1, hitFenced = false;
  for (let i = 0; i < parts.length; i += 2) {
    if (FENCE.test(parts[i])) { fenced = !fenced; continue; }
    if (!loose.test(parts[i])) continue;
    total++;
    if (strict.test(parts[i]) && !fenced) hit = i;
    else if (fenced) hitFenced = true;
  }
  if (fenced) throw new Error('unbalanced code fence: ambiguous sections');
  if (total === 0) throw new Error(`task ${taskId} not found`);
  if (total > 1) throw new Error(`duplicate or ambiguous task ${taskId} (${total} lookalikes)`);
  if (hit < 0) throw new Error(hitFenced ? `task ${taskId} appears only inside a fence` : `task ${taskId} is a lookalike, not a task line`);

  const oldLine = parts[hit];
  const markerAt = oldLine.search(/- \[[ xX\-]\]/) + 3;
  const marker = oldLine[markerAt];
  if (marker !== ' ' && marker !== '-') throw new Error(`marker [${marker}] is already verified or not eligible`);

  const verdict = verifyVerdictFile({ ref: resultRef, expected: { task: taskId, todo: rel, taskLine: oldLine } });
  if (verdict.verdict !== 'PASS') throw new Error(`verdict is ${verdict.verdict}, not PASS`);
  if (apply && verdict.evidence === 'uncorroborated' && !acceptUncorroborated) {
    throw new Error('result is uncorroborated (no settlement); re-run with --accept-uncorroborated to apply');
  }
  const newLine = stripReviewSuffix(oldLine.slice(0, markerAt) + 'x' + oldLine.slice(markerAt + 1)) +
    ` — Auditor-verified ${today} (PASS; verdict=${verdict.dispatchId}; sha256=${verdict.sha256})`;
  const report = { applied: false, evidence: verdict.evidence, verdict: verdict.verdict, oldLine, newLine, todo: rel, ref: verdict.dispatchId };
  if (!apply) return report;

  parts[hit] = newLine;
  const output = Buffer.from(parts.join(''), 'utf8');
  _beforeWrite?.();
  if (!fs.readFileSync(todo).equals(original)) throw new Error('todo changed since it was read; nothing written');
  const temp = path.join(path.dirname(todo), `.mark-${randomBytes(8).toString('hex')}.tmp`);
  try {
    fs.writeFileSync(temp, output, { flag: 'wx', mode: stat.mode & 0o777 });
    fs.renameSync(temp, todo);
  } catch (error) { try { fs.unlinkSync(temp); } catch { /* already gone */ } throw error; }
  return { ...report, applied: true };
}

function usage(why) {
  console.error(`${why}\nusage: node scripts/mark-verified.mjs <todo> <TaskID> <result-ref> [--root dir] [--apply] [--accept-uncorroborated]`);
  return 2;
}

function cli(argv) {
  const pos = []; const o = { apply: false, accept: false, root: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') o.apply = true;
    else if (a === '--accept-uncorroborated') o.accept = true;
    else if (a === '--root' && argv[i + 1]) o.root = argv[++i];
    else if (a.startsWith('--')) return usage(`unknown option ${a}`);
    else pos.push(a);
  }
  if (pos.length !== 3) return usage('expected <todo> <TaskID> <result-ref>');
  try {
    const r = markVerified({ root: o.root, todo: path.resolve(pos[0]), taskId: pos[1], resultRef: path.resolve(pos[2]), apply: o.apply, acceptUncorroborated: o.accept });
    console.log(`${r.applied ? 'APPLIED' : 'DRY RUN'} ${r.todo} ${pos[1]} verdict=${r.verdict} evidence=${r.evidence}`);
    if (r.evidence === 'uncorroborated') console.log('note: uncorroborated; --apply needs --accept-uncorroborated');
    console.log(`- ${r.oldLine}\n+ ${r.newLine}`);
    return 0;
  } catch (error) { console.error(`REFUSED: ${error.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = cli(process.argv.slice(2));
