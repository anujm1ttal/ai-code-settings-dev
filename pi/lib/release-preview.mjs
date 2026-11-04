import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MARKER = 'pi-t16-isolated\n';
const EXTENSIONS = ['pi/extensions/guard.ts', 'pi/extensions/session-observability.ts', 'pi/extensions/role-agent.ts'];
const FILES = [
  'Pi-global.md',
  'hooks/license-gate.json',
  'pi/agents/auditor.md', 'pi/agents/coder.md', 'pi/agents/strategist.md', 'pi/agents/scribe.md', 'pi/agents/explorer.md', 'pi/agents/council-perspectives.md', 'pi/agents/council-synthesis.md',
  ...EXTENSIONS,
  'pi/extensions/role-guard.ts', 'pi/extensions/auditor-recorder.ts',
  'pi/lib/role-policy.mjs', 'pi/lib/role-runner.mjs', 'pi/lib/child-runtime.mjs', 'pi/lib/result-contract.mjs', 'pi/lib/concierge-guard.mjs',
  'pi/lib/council-evidence.mjs', 'pi/lib/council-perspective.mjs', 'pi/lib/council-session.mjs',
  'pi/lib/job-manager.mjs', 'pi/lib/explorer-jobs.mjs', 'pi/lib/audit-evidence.mjs',
  'pi/lib/job-budget.mjs', 'pi/lib/expensive-gate.mjs', 'pi/lib/task-usage.mjs', 'pi/lib/pricing.mjs',
  'pi/lib/read-intercept.mjs', 'pi/lib/bulk-admission.mjs', 'pi/lib/verdict.mjs',
  'pi/lib/role-guard-core.mjs', 'pi/lib/role-ownership.mjs', 'pi/lib/todo-ownership.mjs', 'pi/lib/auditor-recorder.mjs',
];
const PROMPTS = ['agents-md', 'audit', 'blueprint', 'bulk-read-system', 'clean', 'council', 'docs', 'explain', 'graduate', 'grill', 'handoff', 'implement', 'ingest', 'learn', 'registry-audit', 'skill-graph', 'snapshot', 'sweep', 'sync', 'triage'].map(name => `pi/prompts/${name}.md`);
const RETAINED = ['scripts/check-markers.mjs', 'pi/lib/verdict.mjs', 'pi/lib/todo-ownership.mjs'];
const OWNERSHIP = Buffer.from(JSON.stringify({ version: 1, roles: { strategist: { plans: [], todos: ['Artifacts/Plans/*.md'] }, coder: { residual: true, generated: [] }, auditor: { todos: ['Artifacts/Plans/*.md'] }, scribe: { docs: [] } }, protected: [], approvalLinePrefixes: ['Approval:'] }, null, 2) + '\n');

function verifySandbox(root) {
  if (!path.isAbsolute(root) || !fs.existsSync(root) || fs.lstatSync(root).isSymbolicLink()) {
    throw new Error('A real, absolute isolated sandbox root is required');
  }
  const realRoot = fs.realpathSync(root);
  const temp = fs.realpathSync(os.tmpdir());
  const relative = path.relative(temp, realRoot);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative) ||
      fs.readFileSync(path.join(realRoot, '.pi-pilot-sandbox'), 'utf8') !== MARKER) {
    throw new Error('Pi preview is restricted to a marked directory under the OS temp root');
  }
  return realRoot;
}

function rejectSymlinks(root) {
  let stat;
  try { stat = fs.lstatSync(root); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error(`Symlink in isolated destination: ${root}`);
  if (!stat.isDirectory()) throw new Error(`Not a directory in isolated destination: ${root}`);
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const name = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in isolated destination: ${name}`);
    if (entry.isDirectory()) rejectSymlinks(name);
  }
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const activeHandles = new WeakSet();

function createDirectories(handle, directory) {
  if (fs.existsSync(directory)) {
    if (!fs.lstatSync(directory).isDirectory()) throw new Error(`Not a directory in isolated destination: ${directory}`);
    return;
  }
  createDirectories(handle, path.dirname(directory));
  fs.mkdirSync(directory);
  handle.createdDirectories.push(directory);
}

function stageFile(handle, name, bytes) {
  const target = path.join(handle.destination, name);
  createDirectories(handle, path.dirname(target));
  let prior = null;
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error(`Not a regular single-link Pi destination file: ${name}`);
    prior = fs.readFileSync(target);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (prior !== null) {
    const saved = path.join(handle.backup, name);
    fs.mkdirSync(path.dirname(saved), { recursive: true });
    fs.writeFileSync(saved, prior);
  }
  const record = { name, existed: prior !== null, type: prior === null ? 'absent' : 'file', sha256: prior === null ? null : sha256(prior), bytes: prior === null ? 0 : prior.length };
  handle.records.push(record);
  fs.writeFileSync(target, bytes);
  if (sha256(fs.readFileSync(target)) !== sha256(bytes)) throw new Error(`Staged hash mismatch: ${name}`);
}

function buildManifest(sourceRoot) {
  const entries = [...FILES, ...PROMPTS].map(source => ({ source, destination: source === 'Pi-global.md' ? 'AGENTS.md' : source === 'hooks/license-gate.json' ? 'pi/license-gate.json' : source }));
  entries.push(...RETAINED.map(source => ({ source, destination: `pi-retained/${source}` })));
  const destinations = new Set(entries.map(entry => entry.destination));
  if (destinations.size !== entries.length) throw new Error('Duplicate Pi manifest destination');
  for (const entry of entries) {
    const from = path.join(sourceRoot, entry.source);
    if (!fs.lstatSync(from).isFile()) throw new Error(`Not a regular Pi source file: ${entry.source}`);
    const bytes = fs.readFileSync(from);
    entry.sha256 = sha256(bytes);
    if (!/\.(?:mjs|ts)$/.test(entry.source)) continue;
    const imports = bytes.toString('utf8').matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]|\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g);
    for (const match of imports) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(entry.destination), match[1] ?? match[2]));
      if (!destinations.has(target)) throw new Error(`Unstaged relative import: ${entry.destination} -> ${target}`);
    }
  }
  entries.push({ source: 'synthetic:role-ownership', destination: 'role-ownership.json', sha256: sha256(OWNERSHIP) });
  return entries;
}

export function stagePreview({ sourceRoot, sandboxRoot }) {
  const sandbox = verifySandbox(sandboxRoot);
  const destination = path.join(sandbox, 'agent');
  const backup = path.join(sandbox, 'backup');
  rejectSymlinks(destination);
  rejectSymlinks(backup);
  if (fs.existsSync(backup)) throw new Error('Refusing to replace an existing Pi preview backup');
  const hadDestination = fs.existsSync(destination);
  const manifest = buildManifest(sourceRoot);
  if (fs.existsSync(path.join(destination, 'pi-retained'))) throw new Error('Refusing to replace existing retained checker');
  const handle = { sandbox, destination, backup, hadDestination, manifest, records: [], createdDirectories: [], retainChecker: false };
  activeHandles.add(handle);
  try {
    fs.mkdirSync(backup);
    createDirectories(handle, destination);
    for (const entry of manifest) {
      const bytes = entry.source === 'synthetic:role-ownership' ? OWNERSHIP : fs.readFileSync(path.join(sourceRoot, entry.source));
      if (sha256(bytes) !== entry.sha256) throw new Error(`Source changed after manifest: ${entry.source}`);
      stageFile(handle, entry.destination, bytes);
      if (sha256(fs.readFileSync(path.join(destination, entry.destination))) !== entry.sha256) throw new Error(`Manifest mismatch: ${entry.destination}`);
    }
    const settingsPath = path.join(destination, 'settings.json');
    let matching = false;
    if (fs.existsSync(settingsPath)) {
      try { matching = JSON.stringify(JSON.parse(fs.readFileSync(settingsPath, 'utf8')).extensions) === JSON.stringify(EXTENSIONS); }
      catch { /* Preserve prior preview behavior for invalid settings. */ }
    }
    if (!matching) stageFile(handle, 'settings.json', Buffer.from(JSON.stringify({
      extensions: EXTENSIONS, prompts: ['pi/prompts'], packages: [],
    }, null, 2) + '\n'));
    handle.retainChecker = true;
    for (const entry of handle.manifest) Object.freeze(entry);
    for (const record of handle.records) Object.freeze(record);
    Object.freeze(handle.manifest); Object.freeze(handle.records); Object.freeze(handle.createdDirectories);
    return Object.freeze(handle);
  } catch (error) {
    try { rollbackPreview(handle); }
    catch (rollbackError) { throw new AggregateError([error, rollbackError], 'Pi preview staging and rollback failed'); }
    throw error;
  }
}

export function rollbackPreview(handle) {
  if (!handle || !activeHandles.has(handle)) throw new Error('Invalid Pi preview rollback handle');
  const sandbox = verifySandbox(handle.sandbox);
  const destination = path.join(sandbox, 'agent');
  const backup = path.join(sandbox, 'backup');
  if (handle.destination !== destination || handle.backup !== backup ||
      typeof handle.hadDestination !== 'boolean' || !Array.isArray(handle.records) || !Array.isArray(handle.createdDirectories)) throw new Error('Invalid Pi preview rollback handle');
  if (!fs.existsSync(backup)) throw new Error('Pi preview backup is missing');
  rejectSymlinks(destination);
  rejectSymlinks(backup);
  for (const record of handle.records) {
    const target = path.join(destination, record.name);
    try {
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error(`Invalid rollback destination: ${record.name}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!record.existed) continue;
    const saved = path.join(backup, record.name), stat = fs.lstatSync(saved);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error(`Invalid backup file: ${record.name}`);
    const bytes = fs.readFileSync(saved);
    if (bytes.length !== record.bytes || sha256(bytes) !== record.sha256) throw new Error(`Pi preview backup hash mismatch: ${record.name}`);
  }
  for (const record of [...handle.records].reverse()) {
    if (handle.retainChecker && record.name.startsWith('pi-retained/')) continue;
    const target = path.join(destination, record.name);
    if (record.existed) fs.copyFileSync(path.join(backup, record.name), target);
    else fs.rmSync(target, { force: true });
  }
  for (const directory of [...handle.createdDirectories].reverse()) {
    try { fs.rmdirSync(directory); }
    catch (error) { if (!['ENOTEMPTY', 'ENOENT'].includes(error.code)) throw error; }
  }
  fs.rmSync(backup, { recursive: true, force: true });
  activeHandles.delete(handle);
}
