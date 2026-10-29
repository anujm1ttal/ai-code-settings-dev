import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MARKER = 'pi-t16-isolated\n';
const EXTENSIONS = ['pi/extensions/guard.ts', 'pi/extensions/session-observability.ts', 'pi/extensions/role-agent.ts'];
const FILES = [
  'Pi-global.md',
  'hooks/license-gate.json',
  'pi/agents/auditor.md', 'pi/agents/coder.md', 'pi/agents/strategist.md', 'pi/agents/scribe.md', 'pi/agents/explorer.md', 'pi/agents/council-perspectives.md', 'pi/agents/council-synthesis.md',
  ...EXTENSIONS,
  'pi/lib/role-policy.mjs', 'pi/lib/role-runner.mjs', 'pi/lib/concierge-guard.mjs',
  'pi/lib/council-evidence.mjs', 'pi/lib/council-perspective.mjs', 'pi/lib/council-session.mjs',
];

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

function copySource(sourceRoot, relative, destination, name = relative) {
  const from = path.join(sourceRoot, relative);
  if (!fs.lstatSync(from).isFile()) throw new Error(`Not a regular Pi source file: ${relative}`);
  const target = path.join(destination, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(from, target);
}

export function stagePreview({ sourceRoot, sandboxRoot }) {
  const sandbox = verifySandbox(sandboxRoot);
  const destination = path.join(sandbox, 'agent');
  const backup = path.join(sandbox, 'backup');
  rejectSymlinks(destination);
  rejectSymlinks(backup);
  if (fs.existsSync(backup)) throw new Error('Refusing to replace an existing Pi preview backup');
  const hadDestination = fs.existsSync(destination);
  if (hadDestination) fs.cpSync(destination, backup, { recursive: true });
  const handle = { sandbox, destination, backup, hadDestination };
  try {
    fs.mkdirSync(destination, { recursive: true });
    for (const relative of FILES) copySource(sourceRoot, relative, destination,
      relative === 'Pi-global.md' ? 'AGENTS.md' : relative === 'hooks/license-gate.json' ? 'pi/license-gate.json' : relative);
    const promptDir = path.join(sourceRoot, 'pi/prompts');
    for (const name of fs.readdirSync(promptDir).filter(name => name.endsWith('.md'))) {
      copySource(sourceRoot, `pi/prompts/${name}`, destination);
    }
    fs.writeFileSync(path.join(destination, 'settings.json'), JSON.stringify({
      extensions: EXTENSIONS, prompts: ['pi/prompts'], packages: [],
    }, null, 2) + '\n');
    return handle;
  } catch (error) {
    try { rollbackPreview(handle); }
    catch (rollbackError) { throw new AggregateError([error, rollbackError], 'Pi preview staging and rollback failed'); }
    throw error;
  }
}

export function rollbackPreview(handle) {
  const sandbox = verifySandbox(handle.sandbox);
  const destination = path.join(sandbox, 'agent');
  const backup = path.join(sandbox, 'backup');
  if (handle.destination !== destination || handle.backup !== backup ||
      typeof handle.hadDestination !== 'boolean') throw new Error('Invalid Pi preview rollback handle');
  if (handle.hadDestination && !fs.existsSync(backup)) throw new Error('Pi preview backup is missing');
  rejectSymlinks(destination);
  rejectSymlinks(backup);
  if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
  if (handle.hadDestination) fs.cpSync(backup, destination, { recursive: true });
  if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
}
