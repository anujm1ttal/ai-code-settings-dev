import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; throw new Error('network forbidden'); };
after(() => { globalThis.fetch = originalFetch; assert.equal(fetchCalls, 0); });

function sdkPath() {
  const explicit = process.env.PI_CHILD_RUNTIME_MODULE;
  if (explicit) {
    if (!path.isAbsolute(explicit)) throw new Error('PI_CHILD_RUNTIME_MODULE must be absolute');
    return explicit;
  }
  const root = process.env.PI_MANAGED_INSTALL_ROOT || path.join(os.homedir(), '.pi', 'agent', 'install');
  const version = fs.readFileSync(path.join(root, 'current-version'), 'utf8').trim();
  if (!version || version === '.' || version === '..' || !/^[0-9A-Za-z._+-]+$/.test(version)) {
    throw new Error('Invalid managed Pi version');
  }
  return path.join(root, 'releases', version, 'node_modules', '@earendil-works', 'pi-coding-agent', 'dist', 'index.js');
}
let entry;
try { entry = sdkPath(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const absent = !entry || !fs.existsSync(entry);
const sdk = absent ? undefined : await import(pathToFileURL(entry).href);
const skip = absent ? 'Installed Pi SDK entry or current-version absent' : false;
const bytes = (s) => Buffer.from(s, 'utf8');
const equalBytes = (actual, expected) => assert.deepEqual(actual, bytes(expected));

async function fixture(initial, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-feasibility-'));
  const file = path.join(dir, 'todo.md');
  try {
    fs.writeFileSync(file, bytes(initial));
    await fn({ dir, file });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const run = (tool, dir, input) => tool.execute('offline', input, undefined, undefined, { cwd: dir });
const edit = (file, oldText, newText) => ({ path: file, edits: [{ oldText, newText }] });

// These adapters are experimental controls, not production authorization or atomic CAS.
function mediated(file, validate, { injectDrift = false } = {}) {
  let snapshot, offered, diskBeforeRefusal, validated;
  const ops = {
    access: (p) => fsp.access(p, fs.constants.R_OK | fs.constants.W_OK),
    readFile: async (p) => { snapshot = await fsp.readFile(p); return snapshot; },
    // Native write does not read: snapshot during its mkdir operation, within the tool queue.
    mkdir: async (dir) => { await fsp.mkdir(dir, { recursive: true }); snapshot = await fsp.readFile(file); },
    writeFile: async (p, content) => {
      offered = bytes(content);
      if (injectDrift) await fsp.writeFile(p, Buffer.concat([snapshot, bytes('external drift')]));
      const current = await fsp.readFile(p);
      diskBeforeRefusal = current;
      if (!snapshot.equals(current)) throw new Error('drift refused');
      validate(snapshot, offered);
      validated = Buffer.from(offered);
      await fsp.writeFile(p, offered);
    },
  };
  return { ops, state: () => ({ snapshot, offered, diskBeforeRefusal, validated }) };
}
function expectedOnly(original, before, after) {
  const source = original.toString('utf8');
  assert.equal(source.split(before).length, 2, 'fixture marker must be unique');
  return bytes(source.replace(before, after));
}
function validator(before, after) {
  return (original, candidate) => {
    if (!candidate.equals(expectedOnly(original, before, after))) throw new Error('candidate refused');
  };
}

test('A: edit collapses mixed line endings; BOM and final-newline state', { skip }, async () => {
  for (const [input, expected] of [
    ['one\r\ntarget\nlast\r\n', 'one\r\nchanged\r\nlast\r\n'],
    ['\ufeffone\r\ntarget\nlast', '\ufeffone\r\nchanged\r\nlast'],
    ['one\ntarget\r\nlast', 'one\nchanged\nlast'],
  ]) await fixture(input, async ({ dir, file }) => {
    await run(sdk.createEditToolDefinition(dir), dir, edit(file, 'target', 'changed'));
    equalBytes(await fsp.readFile(file), expected);
    assert.notDeepEqual(bytes(expected), expectedOnly(bytes(input), 'target', 'changed'));
  });
});

test('B: fuzzy matching rewrites the touched line but preserves other line characters', { skip }, async () => {
  const input = 'keep “other” — untouched  \nleft “quote” — target  \nend “other”  \n';
  const expected = 'keep “other” — untouched  \nleft "quote" - changed\nend “other”  \n';
  await fixture(input, async ({ dir, file }) => {
    await run(sdk.createEditToolDefinition(dir), dir, edit(file, '"quote" - target', '"quote" - changed'));
    equalBytes(await fsp.readFile(file), expected);
    assert.notDeepEqual(bytes(expected), expectedOnly(bytes(input), 'target', 'changed'));
  });
});

test('C: pre-execute candidate cannot account for intervening drift', { skip }, async () => {
  await fixture('task [ ]\nother\n', async ({ dir, file }) => {
    const snapshot = await fsp.readFile(file);
    const candidate = expectedOnly(snapshot, '[ ]', '[x]');
    await fsp.writeFile(file, bytes('task [ ]\nexternal\n'));
    await run(sdk.createEditToolDefinition(dir), dir, edit(file, '[ ]', '[x]'));
    const actual = await fsp.readFile(file);
    equalBytes(actual, 'task [x]\nexternal\n');
    assert.notDeepEqual(actual, candidate);
  });
});

test('D: edit and write mediation captures candidate, refuses drift and invalid bytes, approves exact bytes', { skip }, async () => {
  for (const kind of ['edit', 'write']) for (const mode of ['approved', 'invalid', 'drift']) {
    await fixture('task [ ]\nother\n', async ({ dir, file }) => {
      const before = 'task [ ]';
      const after = 'task [x]';
      const adapter = mediated(file, validator(before, after), { injectDrift: mode === 'drift' });
      const tool = kind === 'edit' ? sdk.createEditToolDefinition(dir, { operations: adapter.ops }) : sdk.createWriteToolDefinition(dir, { operations: adapter.ops });
      const changed = mode === 'invalid' ? 'task [!]': after;
      const input = kind === 'edit' ? edit(file, before, changed) : { path: file, content: `${changed}\nother\n` };
      if (mode === 'approved') await run(tool, dir, input);
      else await assert.rejects(run(tool, dir, input), mode === 'drift' ? /drift refused/ : /candidate refused/);
      const state = adapter.state();
      equalBytes(state.snapshot, 'task [ ]\nother\n');
      equalBytes(state.offered, `${changed}\nother\n`);
      const actual = await fsp.readFile(file);
      if (mode === 'approved') { assert.deepEqual(actual, state.validated); equalBytes(actual, 'task [x]\nother\n'); }
      else { assert.deepEqual(actual, state.diskBeforeRefusal); assert.equal(state.validated, undefined); }
      if (mode === 'invalid') equalBytes(actual, 'task [ ]\nother\n');
      if (mode === 'drift') equalBytes(actual, 'task [ ]\nother\nexternal drift');
    });
  }
});

test('E: byte-preserving auditor operation: uniform control succeeds, mixed EOL edit and destructive write refused', { skip }, async () => {
  const before = '- [ ] T1';
  const after = '- [x] T1 — Auditor-verified (x)';
  const uniform = '\ufeff# TODO\nApproval: yes\n- [ ] T1\n- [ ] T2';
  const mixed = '\ufeff# TODO\r\nApproval: yes\n- [ ] T1\r\n- [ ] T2';
  for (const [initial, allowed] of [[uniform, true], [mixed, false]]) {
    await fixture(initial, async ({ dir, file }) => {
      const adapter = mediated(file, validator(before, after));
      const tool = sdk.createEditToolDefinition(dir, { operations: adapter.ops });
      if (allowed) await run(tool, dir, edit(file, before, after));
      else await assert.rejects(run(tool, dir, edit(file, before, after)), /candidate refused/);
      const state = adapter.state();
      const expected = expectedOnly(bytes(initial), before, after);
      assert.deepEqual(state.snapshot, bytes(initial));
      const actual = await fsp.readFile(file);
      if (allowed) { assert.deepEqual(state.offered, expected); assert.deepEqual(actual, expected); assert.deepEqual(state.validated, expected); }
      else {
        equalBytes(state.offered, '\ufeff# TODO\r\nApproval: yes\r\n- [x] T1 — Auditor-verified (x)\r\n- [ ] T2');
        assert.notDeepEqual(state.offered, expected);
        assert.deepEqual(actual, bytes(initial));
      }
    });
  }
  for (const candidate of [
    '\ufeff# TODO\r\nApproval: yes\n- [x] T1 — Auditor-verified (x)',
    '\ufeff# TODO\r\nApproval: no\n- [x] T1 — Auditor-verified (x)\r\n- [ ] T2',
  ]) await fixture(mixed, async ({ dir, file }) => {
    const adapter = mediated(file, validator(before, after));
    await assert.rejects(run(sdk.createWriteToolDefinition(dir, { operations: adapter.ops }), dir, { path: file, content: candidate }), /candidate refused/);
    assert.deepEqual(adapter.state().offered, bytes(candidate));
    assert.deepEqual(await fsp.readFile(file), bytes(mixed));
  });
});

test('queue export serializes overlapping same-path operations in process', { skip }, async () => {
  await fixture('x', async ({ file }) => {
    const events = [];
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let started;
    const entered = new Promise((resolve) => { started = resolve; });
    const first = sdk.withFileMutationQueue(file, async () => { events.push('first start'); started(); await gate; events.push('first end'); });
    await entered;
    const second = sdk.withFileMutationQueue(file, async () => { events.push('second'); });
    release();
    await Promise.all([first, second]);
    assert.deepEqual(events, ['first start', 'first end', 'second']);
    equalBytes(await fsp.readFile(file), 'x');
  });
});
