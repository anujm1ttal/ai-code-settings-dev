import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { conciergeToolDenial } from '../pi/lib/concierge-guard.mjs';

function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-concierge-'));
  fs.mkdirSync(path.join(root, 'Artifacts', '.agent'), { recursive: true });
  for (const file of ['Artifacts/.agent/current_task.md', 'Artifacts/HANDOFF_BRIEF.md', 'Artifacts/TODO.md', 'src/code.ts']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), 'before\n');
  }
  try { run(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function hash(root) {
  const entries = [];
  function walk(dir, prefix = '') {
    for (const name of fs.readdirSync(dir).sort()) {
      const relative = path.posix.join(prefix, name);
      const absolute = path.join(dir, name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) entries.push(`${relative}:link:${fs.readlinkSync(absolute)}`);
      else if (stat.isDirectory()) { entries.push(`${relative}:dir`); walk(absolute, relative); }
      else entries.push(`${relative}:file:${createHash('sha256').update(fs.readFileSync(absolute)).digest('hex')}`);
    }
  }
  walk(root);
  return createHash('sha256').update(entries.join('\n')).digest('hex');
}

test('concierge permits writes to exactly the two state files, and denied attempts leave the tree unchanged', () => fixture(root => {
  for (const file of ['Artifacts/.agent/current_task.md', 'Artifacts/HANDOFF_BRIEF.md']) {
    for (const tool of ['edit', 'write']) assert.equal(conciergeToolDenial(root, tool,
      tool === 'write' ? { path: file, content: 'after' } : { path: file, edits: [{ oldText: 'before', newText: 'after' }] }), undefined);
  }
  assert.equal(conciergeToolDenial(root, 'write', { path: path.join(root, 'Artifacts', 'HANDOFF_BRIEF.md'), content: 'after' }), undefined);
  const before = hash(root);
  for (const file of ['Artifacts/TODO.md', 'Artifacts/DECISION_LOG.md', 'src/code.ts', 'Artifacts/.agent/other.md',
    path.join(os.homedir(), '.pi', 'agent', 'AGENTS.md'), '../outside.md',
    'Artifacts/.agent/../HANDOFF_BRIEF.md', 'Artifacts/HANDOFF_BRIEF.md:stream',
    'Artifacts/HANDOFF_BRIEF.md.', 'ARTIFACTS/HANDOFF_BRIEF.md', 'Artifacts/.agent']) {
    assert.match(conciergeToolDenial(root, 'write', { path: file }), /.+/, file);
  }
  for (const tool of ['bash', 'powershell', 'mcp__write']) {
    assert.match(conciergeToolDenial(root, tool, {}), /.+/);
  }
  assert.equal(hash(root), before);
}));

test('concierge write and edit enforce UTF-8 byte ceilings before tool execution', () => fixture(root => {
  for (const [file, cap] of [['Artifacts/.agent/current_task.md', 2000], ['Artifacts/HANDOFF_BRIEF.md', 16384]]) {
    assert.equal(conciergeToolDenial(root, 'write', { path: file, content: 'é'.repeat(cap / 2) }), undefined);
    assert.match(conciergeToolDenial(root, 'write', { path: file, content: 'é'.repeat(cap / 2 + 1) }), /limit/i);
    assert.match(conciergeToolDenial(root, 'edit', { path: file, edits: [{ oldText: 'before', newText: 'é'.repeat(cap / 2) }] }), /limit/i);
    assert.equal(conciergeToolDenial(root, 'edit', { path: file, edits: [{ oldText: 'before', newText: 'after' }] }), undefined);
  }
}));

test('allowed updates change only the two designated state files in the before/after tree snapshot', () => fixture(root => {
  const protectedFiles = ['Artifacts/TODO.md', 'src/code.ts'];
  const protectedBefore = protectedFiles.map(file => fs.readFileSync(path.join(root, file)));
  const before = hash(root);
  for (const file of ['Artifacts/.agent/current_task.md', 'Artifacts/HANDOFF_BRIEF.md']) {
    assert.equal(conciergeToolDenial(root, 'write', { path: file, content: 'after\n' }), undefined);
    fs.writeFileSync(path.join(root, file), 'after\n');
  }
  assert.notEqual(hash(root), before);
  protectedFiles.forEach((file, index) => assert.deepEqual(fs.readFileSync(path.join(root, file)), protectedBefore[index]));
}));

test('symlinks, junctions, hardlinks, and non-file targets cannot alias an allowed write', t => fixture(root => {
  const target = path.join(root, 'Artifacts', 'HANDOFF_BRIEF.md');
  const outside = path.join(root, 'src', 'code.ts');
  fs.rmSync(target);
  fs.mkdirSync(target);
  assert.match(conciergeToolDenial(root, 'write', { path: 'Artifacts/HANDOFF_BRIEF.md' }), /.+/);
  fs.rmdirSync(target);
  fs.linkSync(outside, target);
  assert.match(conciergeToolDenial(root, 'edit', { path: 'Artifacts/HANDOFF_BRIEF.md' }), /.+/);
  fs.rmSync(target);
  try { fs.symlinkSync(outside, target, 'file'); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) t.diagnostic(`file symlink unavailable: ${error.code}`);
    else throw error;
  }
  if (fs.existsSync(target)) {
    assert.match(conciergeToolDenial(root, 'write', { path: 'Artifacts/HANDOFF_BRIEF.md' }), /.+/);
    fs.rmSync(target);
  }
  const agentDir = path.join(root, 'Artifacts', '.agent');
  fs.rmSync(agentDir, { recursive: true });
  try { fs.symlinkSync(path.dirname(outside), agentDir, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) t.diagnostic(`junction unavailable: ${error.code}`);
    else throw error;
  }
  assert.match(conciergeToolDenial(root, 'write', { path: 'Artifacts/.agent/current_task.md' }), /.+/);
}));

test('root alias and alternate path spellings cannot widen the allowlist', t => fixture(root => {
  const alias = `${root}-alias`;
  try { fs.symlinkSync(root, alias, process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.diagnostic(`root junction unavailable: ${error.code}`);
      return;
    }
    throw error;
  }
  try { assert.match(conciergeToolDenial(alias, 'write', { path: 'Artifacts/HANDOFF_BRIEF.md' }), /.+/); }
  finally { fs.rmSync(alias, { recursive: true, force: true }); }
}));
