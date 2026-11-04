// Read-only preview of the exact shared-validator recording; the bound Auditor owns writes.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyVerdictFile } from '../pi/lib/verdict.mjs';
import { parseTodo, buildAuditorRecording } from '../pi/lib/todo-ownership.mjs';

const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function markVerified({ root, todo, taskId, resultRef, apply = false, today = localDate() }) {
  if (apply) throw new Error('apply retired; recording is done by the bound Auditor recorder');
  if (typeof taskId !== 'string' || !/^[A-Za-z0-9._-]{1,40}$/.test(taskId)) throw new Error('invalid task id');
  const stat = fs.lstatSync(todo);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('todo is not a regular file (link refused)');
  const rootReal = fs.realpathSync(root);
  const rel = path.relative(rootReal, fs.realpathSync(todo)).split(path.sep).join('/');
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('todo is outside the project');
  if (rel.toLowerCase() === 'artifacts/todo.md') throw new Error('top-level TODO is not eligible (phase TODOs only)');

  const original = fs.readFileSync(todo);
  const parsed = parseTodo(original);
  if (!parsed.eligible) throw new Error(`ineligible todo: ${parsed.errors.join('; ')}`);
  const task = parsed.tasks.find(t => t.id === taskId);
  if (!task) throw new Error(`task ${taskId} not found`);
  const oldLine = parsed.lines[task.lineIndex].text;
  if (task.marker === 'x') throw new Error('task already checked');
  const verdict = verifyVerdictFile({ ref: resultRef, expected: { task: taskId, todo: rel, taskLine: oldLine } });
  if (verdict.verdict !== 'PASS') throw new Error(`verdict is ${verdict.verdict}, not PASS`);
  const ref = `PASS; verdict=${verdict.dispatchId}; sha256=${verdict.sha256}`;
  const built = buildAuditorRecording(original, { taskId, verdict: 'PASS', date: today, ref });
  if (!built.ok) throw new Error(`recording refused: ${built.reasons.join('; ')}`);
  const newLine = parseTodo(built.candidate).lines[task.lineIndex].text;
  return { applied: false, evidence: verdict.evidence, verdict: verdict.verdict, oldLine, newLine, todo: rel, ref: verdict.dispatchId };
}

function usage(why) {
  console.error(`${why}\nusage: node scripts/mark-verified.mjs <todo> <TaskID> <result-ref> [--root dir]`);
  return 2;
}

function cli(argv) {
  if (argv.includes('--apply')) return usage('apply retired; recording is done by the bound Auditor recorder');
  const pos = []; let root = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root' && argv[i + 1]) root = argv[++i];
    else if (a.startsWith('--')) return usage(`unknown option ${a}`);
    else pos.push(a);
  }
  if (pos.length !== 3) return usage('expected <todo> <TaskID> <result-ref>');
  try {
    const r = markVerified({ root, todo: path.resolve(pos[0]), taskId: pos[1], resultRef: path.resolve(pos[2]) });
    console.log(`DRY RUN ${r.todo} ${pos[1]} verdict=${r.verdict} evidence=${r.evidence}`);
    console.log(`- ${r.oldLine}\n+ ${r.newLine}`);
    return 0;
  } catch (error) { console.error(`REFUSED: ${error.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = cli(process.argv.slice(2));
