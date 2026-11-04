import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { loadOwnership, authorizeMutation } from './role-ownership.mjs';
import { parseTodo, buildAuditorRecording, formatRecordingRef } from './todo-ownership.mjs';
import { canonicalTaskHash, verifyVerdictFile } from './verdict.mjs';

const keys = ['todo', 'taskId', 'taskSha256', 'verdictRef', 'verdictSha256', 'manifestPath', 'manifestSha256', 'date'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hex = s => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
const id = s => typeof s === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(s) && s !== '.' && s !== '..';
const relative = s => typeof s === 'string' && s.length > 0 && !/[\\\0:\s]/.test(s) && !s.startsWith('/') &&
  s.split('/').every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part) && !/~\d/i.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(part));
const refuse = reason => { throw new Error(`Recording refused: ${reason}`); };
export function validateBinding(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every(k => Object.hasOwn(value, k))) refuse('binding requires exact keys');
  if (!relative(value.todo) || !relative(value.manifestPath) || !relative(value.verdictRef) || !id(value.taskId) || value.taskId.length > 40 ||
      !hex(value.taskSha256) || !hex(value.verdictSha256) || !hex(value.manifestSha256)) refuse('invalid binding fields');
  const match = /^Artifacts\/\.agent\/pi-results\/([A-Za-z0-9._-]{1,80})\.result$/.exec(value.verdictRef);
  if (!match || !id(match[1])) refuse('invalid result reference');
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) refuse('invalid date');
  const d = new Date(`${value.date}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value.date) refuse('invalid date');
  return Object.freeze({ ...value });
}

// Disallow links and path aliases for evidence too; the binding is relative to the real project root.
function checkedFile(root, rel, io) {
  let current = root;
  for (const part of rel.split('/')) {
    current = path.join(current, part);
    const st = io.lstatSync(current);
    if (st.isSymbolicLink() || io.realpathSync.native(current) !== current) throw new Error('evidence path alias');
  }
  const st = io.lstatSync(current);
  if (!st.isFile() || st.nlink !== 1) throw new Error('evidence is not a regular single-link file');
  return current;
}

export function createRecorder({ binding, projectRoot, globalPath, role, fs: io = fs } = {}) {
  const bound = validateBinding(binding);
  let used = false;
  return function record() {
    if (used) refuse('recorder already used');
    try {
      if (role !== 'auditor') throw new Error('auditor role required');
      if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot) || io.realpathSync.native(projectRoot) !== projectRoot) throw new Error('project root must be absolute and canonical');
      const ownership = loadOwnership({ projectRoot, globalPath });
      const auth = authorizeMutation({ ownership, role: 'auditor', projectRoot, requestedPath: bound.todo, operation: 'edit', globalPath });
      if (!auth.allow || auth.relPath !== bound.todo) throw new Error(`ownership: ${auth.reason}`);
      const target = auth.canonicalPath, original = io.readFileSync(target);
      const prefixes = ownership.policy.approvalLinePrefixes;
      const parsed = parseTodo(original, { approvalLinePrefixes: prefixes });
      if (!parsed.eligible) throw new Error(`ineligible TODO: ${parsed.errors.join('; ')}`);
      const task = parsed.tasks.find(t => t.id === bound.taskId);
      if (!task) throw new Error('task not found');
      const taskLine = parsed.lines[task.lineIndex].text;
      if (canonicalTaskHash(taskLine) !== bound.taskSha256) throw new Error('stale task');
      const resultPath = checkedFile(projectRoot, bound.verdictRef, io);
      if (digest(io.readFileSync(resultPath)) !== bound.verdictSha256) throw new Error('result hash mismatch');
      const verdict = verifyVerdictFile({ ref: resultPath, expected: { task: bound.taskId, todo: bound.todo, taskLine } });
      if (verdict.sha256 !== bound.verdictSha256 || verdict.evidence !== 'settlement' || verdict.verdict === 'INCOMPLETE') throw new Error('result is not a settled PASS or FAIL');
      const manifest = checkedFile(projectRoot, bound.manifestPath, io);
      if (digest(io.readFileSync(manifest)) !== bound.manifestSha256) throw new Error('manifest hash mismatch');
      const ref = formatRecordingRef({ verdict: verdict.verdict, dispatchId: verdict.dispatchId, sha256: verdict.sha256 });
      const built = buildAuditorRecording(original, { taskId: bound.taskId, verdict: verdict.verdict, date: bound.date, ref, approvalLinePrefixes: prefixes });
      if (!built.ok) throw new Error(built.reasons.join('; '));
      if (!io.readFileSync(target).equals(original)) throw new Error('target drift');
      const temp = path.join(path.dirname(target), `.${path.basename(target)}.${randomBytes(16).toString('hex')}.tmp`);
      let fd, created = false;
      try {
        fd = io.openSync(temp, 'wx'); created = true;
        io.writeFileSync(fd, built.candidate); io.closeSync(fd); fd = undefined;
        io.renameSync(temp, target); created = false;
      } finally {
        if (fd !== undefined) io.closeSync(fd);
        if (created) io.unlinkSync(temp);
      }
      used = true;
      return { todo: bound.todo, task: bound.taskId, verdict: verdict.verdict };
    } catch (error) { refuse(error.message); }
  };
}
