import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulePath = path.join(sourceRoot, 'pi/lib/release-preview.mjs');

async function release() {
  assert.ok(fs.existsSync(modulePath), 'Pi isolated preview module must exist');
  return import(pathToFileURL(modulePath).href);
}

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t16-'));
  fs.writeFileSync(path.join(root, '.pi-pilot-sandbox'), 'pi-t16-isolated\n');
  return root;
}

function snapshot(root) {
  const rows = [];
  function visit(dir, relative = '') {
    for (const name of fs.readdirSync(dir).sort()) {
      const entry = path.join(dir, name);
      const rel = path.join(relative, name);
      if (fs.statSync(entry).isDirectory()) { rows.push([rel, 'directory']); visit(entry, rel); }
      else rows.push([rel, fs.readFileSync(entry)]);
    }
  }
  visit(root);
  return rows;
}

test('L04: duplicate manifest destinations refuse before writes', async () => {
  const root = sandbox();
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-manifest-fixture-'));
  try {
    const { stagePreview, rollbackPreview } = await release();
    const control = sandbox();
    try { rollbackPreview(stagePreview({ sourceRoot, sandboxRoot: control })); }
    finally { fs.rmSync(control, { recursive: true, force: true }); }
    // Test-only module fixture: add a duplicate to the otherwise unreachable static file list.
    const source = fs.readFileSync(modulePath, 'utf8');
    const needle = "  'Pi-global.md',\n  'hooks/license-gate.json',";
    assert.equal(source.split(needle).length, 2);
    const module = path.join(fixture, 'release-preview.mjs');
    fs.writeFileSync(module, source.replace(needle, "  'Pi-global.md', 'Pi-global.md',\n  'hooks/license-gate.json',"));
    const injected = await import(pathToFileURL(module).href);
    const before = snapshot(root);
    assert.throws(() => injected.stagePreview({ sourceRoot, sandboxRoot: root }), /Duplicate Pi manifest destination/);
    assert.deepEqual(snapshot(root), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(fixture, { recursive: true, force: true }); }
});

test('L07: an existing retained checker is not replaced', async () => {
  const root = sandbox();
  try {
    const retained = path.join(root, 'agent/pi-retained');
    fs.mkdirSync(retained, { recursive: true });
    fs.writeFileSync(path.join(retained, 'sentinel'), Buffer.from([0, 255, 42]));
    const { stagePreview, rollbackPreview } = await release();
    const before = snapshot(root);
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: root }), /existing retained checker/);
    assert.deepEqual(snapshot(root), before);
    fs.rmSync(retained, { recursive: true });
    rollbackPreview(stagePreview({ sourceRoot, sandboxRoot: root })); // valid control
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('L08: changed source after manifest refuses and restores destination', async () => {
  const root = sandbox();
  const originalRead = fs.readFileSync;
  try {
    const agent = path.join(root, 'agent');
    fs.mkdirSync(agent);
    fs.writeFileSync(path.join(agent, 'AGENTS.md'), 'prior bytes');
    const { stagePreview, rollbackPreview } = await release();
    const control = sandbox();
    try { rollbackPreview(stagePreview({ sourceRoot, sandboxRoot: control })); }
    finally { fs.rmSync(control, { recursive: true, force: true }); }
    const before = snapshot(root);
    const target = path.join(sourceRoot, 'Pi-global.md');
    let reads = 0;
    // Inject only the second read; do not modify the repository source.
    fs.readFileSync = function (file, ...args) {
      const bytes = originalRead.call(this, file, ...args);
      if (file === target && ++reads === 2) return Buffer.from('changed after manifest');
      return bytes;
    };
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: root }), /Source changed after manifest/);
    assert.equal(reads, 2);
    fs.readFileSync = originalRead;
    assert.deepEqual(snapshot(root), before);
    assert.equal(fs.existsSync(path.join(root, 'backup')), false);
  } finally { fs.readFileSync = originalRead; fs.rmSync(root, { recursive: true, force: true }); }
});

test('L10: missing backup refuses rollback before removing originally absent files', async () => {
  const root = sandbox();
  try {
    const { stagePreview, rollbackPreview } = await release();
    const control = sandbox();
    try { rollbackPreview(stagePreview({ sourceRoot, sandboxRoot: control })); }
    finally { fs.rmSync(control, { recursive: true, force: true }); }
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    assert.ok(staged.records.some(record => !record.existed));
    fs.rmSync(staged.backup, { recursive: true });
    const before = snapshot(root);
    assert.throws(() => rollbackPreview(staged), /backup is missing/);
    assert.deepEqual(snapshot(root), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('L11: tampered backup refuses rollback before any destination changes', async () => {
  const root = sandbox();
  try {
    fs.mkdirSync(path.join(root, 'agent'));
    fs.writeFileSync(path.join(root, 'agent/AGENTS.md'), 'original');
    const { stagePreview, rollbackPreview } = await release();
    const control = sandbox();
    try { rollbackPreview(stagePreview({ sourceRoot, sandboxRoot: control })); }
    finally { fs.rmSync(control, { recursive: true, force: true }); }
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    fs.writeFileSync(path.join(staged.backup, 'AGENTS.md'), 'tampered'); // same length
    const before = snapshot(root);
    assert.throws(() => rollbackPreview(staged), /backup hash mismatch/);
    assert.deepEqual(snapshot(root), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('L14 refined: junction ancestor after staging refuses rollback before writes', async t => {
  const root = sandbox();
  let link;
  try {
    fs.mkdirSync(path.join(root, 'agent'));
    fs.writeFileSync(path.join(root, 'agent/AGENTS.md'), 'prior backup bytes');
    const { stagePreview, rollbackPreview } = await release();
    const control = sandbox();
    try { rollbackPreview(stagePreview({ sourceRoot, sandboxRoot: control })); }
    finally { fs.rmSync(control, { recursive: true, force: true }); }
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    link = path.join(staged.destination, 'pi/agents');
    const displaced = path.join(root, 'displaced-agents');
    fs.renameSync(link, displaced);
    try { fs.symlinkSync(displaced, link, 'junction'); }
    catch (error) {
      fs.renameSync(displaced, link); link = undefined;
      if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) return t.skip(`junction unavailable: ${error.code}`);
      throw error;
    }
    const before = snapshot(root);
    assert.throws(() => rollbackPreview(staged), /Symlink in isolated destination/);
    assert.deepEqual(snapshot(root), before);
  } finally {
    if (link) {
      try { if (fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('preview stages the scoped runtime at the default dispatch path', async () => {
  const root = sandbox();
  try {
    const { stagePreview, rollbackPreview } = await release();
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const runner = await import(pathToFileURL(path.join(staged.destination, 'pi/lib/role-runner.mjs')).href);
    const { loadRolePolicy } = await import(pathToFileURL(path.join(staged.destination, 'pi/lib/role-policy.mjs')).href);
    const { EventEmitter } = await import('node:events');
    const { PassThrough } = await import('node:stream');
    const policy = loadRolePolicy(path.join(sourceRoot, 'tests/fixtures/pi-role-policy.json'));
    let dispatched;
    const spawnImpl = (command, args, options) => {
      dispatched = { command, launcher: args[0] };
      const child = new EventEmitter();
      child.stdout = new PassThrough(); child.stderr = new PassThrough();
      queueMicrotask(() => {
        for (const event of [
          { type: 'pi_role_guard_ready', version: 1, role: 'coder', nonce: options.env.PI_ROLE_GUARD_NONCE, tools: ['edit', 'write'] },
          { type: 'pi_child_runtime', retryEnabled: false, retryMaxRetries: 0, providerMaxRetries: 0, compactionEnabled: false },
          { type: 'message_end', message: { role: 'assistant', provider: 'pilot-gpt', model: 'sol', thinkingLevel: 'medium',
            stopReason: 'stop', content: [{ type: 'text', text: 'done' }],
            usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2 } } },
        ]) child.stdout.write(JSON.stringify(event) + '\n');
        child.stdout.end(); child.stderr.end(); child.emit('close', 0);
      });
      return child;
    };
    const result = await runner.runRole(policy, 'coder', 'fixture', root, '/role.md', { spawnImpl });
    assert.equal(result.runtimeVerified, true);
    assert.equal(dispatched.command, process.execPath);
    assert.equal(dispatched.launcher, path.join(staged.destination, 'pi/lib/child-runtime.mjs'));
    assert.equal(fs.readFileSync(dispatched.launcher, 'utf8'), fs.readFileSync(path.join(sourceRoot, 'pi/lib/child-runtime.mjs'), 'utf8'));
    rollbackPreview(staged);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('preview stages the complete role guard closure byte-for-byte', async () => {
  const root = sandbox();
  try {
    const { stagePreview, rollbackPreview } = await release();
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const closure = ['pi/extensions/role-guard.ts', 'pi/lib/role-guard-core.mjs',
      'pi/lib/role-ownership.mjs', 'pi/lib/todo-ownership.mjs', 'pi/lib/verdict.mjs'];
    for (const relative of closure) {
      const target = path.join(staged.destination, relative);
      assert.ok(fs.existsSync(target), `${relative} must be staged`);
      assert.deepEqual(fs.readFileSync(target), fs.readFileSync(path.join(sourceRoot, relative)), relative);
    }
    // Follow all three entrypoints, including the runner's own dependencies.
    const visited = new Set(), pending = [closure[0], 'pi/lib/child-runtime.mjs', 'pi/lib/role-runner.mjs'];
    const manifest = new Set(staged.manifest.map(entry => entry.destination));
    if (process.env.PI10_RELEASE_MUTATION === 'missing-guard-core') {
      fs.rmSync(path.join(staged.destination, 'pi/lib/role-guard-core.mjs'));
    }
    while (pending.length) {
      const relative = pending.pop();
      if (visited.has(relative)) continue;
      visited.add(relative);
      assert.ok(manifest.has(relative), `${relative} must be in the staging manifest`);
      assert.ok(fs.existsSync(path.join(staged.destination, relative)), `${relative} must exist in staged tree`);
      const text = fs.readFileSync(path.join(staged.destination, relative), 'utf8');
      const imports = [...text.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]|\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)]
        .map(match => match[1] ?? match[2]);
      if (relative === closure[0] || relative === closure[1]) {
        assert.ok(imports.length, `${relative} must have a relative import to check`);
      }
      for (const specifier of imports) {
        const target = path.resolve(staged.destination, path.dirname(relative), specifier);
        const next = path.relative(staged.destination, target);
        assert.ok(next && next !== '..' && !next.startsWith(`..${path.sep}`) && !path.isAbsolute(next),
          `${relative} import ${specifier} must stay inside the staged tree`);
        assert.ok(fs.existsSync(target), `${relative} import ${specifier} must resolve in the staged tree`);
        assert.deepEqual(fs.readFileSync(target), fs.readFileSync(path.join(sourceRoot, next)), next);
        pending.push(next.split(path.sep).join('/'));
      }
    }
    assert.ok(closure.every(relative => visited.has(relative)), 'all known guard dependencies were traversed');
    const runnerSource = fs.readFileSync(path.join(staged.destination, 'pi/lib/role-runner.mjs'), 'utf8');
    const guardList = runnerSource.match(/const GUARD_CLOSURE = \[([\s\S]*?)\];/);
    assert.ok(guardList, 'runner guard closure declaration exists');
    const guardEntries = [...guardList[1].matchAll(/'([^']+)'/g)].map(match =>
      path.posix.normalize(path.posix.join('pi/lib', match[1])));
    assert.deepEqual(new Set(guardEntries), new Set(closure), 'runner preflight covers guard closure');
    rollbackPreview(staged);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('PI10 staged default runner executes healthy guard and refuses silent guard before inference', { timeout: 90000 }, async () => {
  const entry = process.env.PI_CODING_AGENT_SDK_PATH;
  assert.ok(entry && path.isAbsolute(entry) && fs.existsSync(entry), 'installed SDK entry required; no skip');
  const root = sandbox();
  let staged;
  try {
    const agent = path.join(root, 'agent'), cwd = path.join(root, 'work space');
    fs.mkdirSync(agent); fs.mkdirSync(cwd);
    fs.writeFileSync(path.join(agent, 'AGENTS.md'), Buffer.from([0, 255, 42]));
    // The SDK creates these disposable stores on first startup; pre-seed them so
    // the rollback comparison isolates preview-owned paths from SDK initialization.
    fs.writeFileSync(path.join(agent, 'auth.json'), '{}');
    fs.writeFileSync(path.join(agent, 'models-store.json'), '{}');
    const before = snapshot(agent);
    const { stagePreview, rollbackPreview } = await release();
    staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    for (const item of staged.manifest.filter(item => !item.source.startsWith('synthetic:'))) {
      const source = fs.readFileSync(path.join(sourceRoot, item.source));
      const actual = fs.readFileSync(path.join(agent, item.destination));
      assert.deepEqual(actual, source, item.source);
      assert.equal(hash(actual), item.sha256, item.source);
    }
    const guard = path.join(agent, 'pi/extensions/role-guard.ts');
    const healthy = fs.readFileSync(guard);
    const prompt = path.join(root, 'prompt.md'); fs.writeFileSync(prompt, 'Offline fixture');
    const preload = path.join(root, 'preload.mjs');
    fs.writeFileSync(preload, `import { appendFileSync } from 'node:fs'; import * as sdk from ${JSON.stringify(pathToFileURL(entry).href)};
const refresh=sdk.AgentSession.prototype._refreshToolRegistry; sdk.AgentSession.prototype._refreshToolRegistry=function(...args) { for (const [name,d] of this._baseToolDefinitions) { if (['edit','write'].includes(name) && !d.__pi10Counted) { const execute=d.execute; d.execute=function(...a) { appendFileSync(process.env.PI10_NATIVE,name+'\\n'); return execute.apply(this,a); }; d.__pi10Counted=true; } } return refresh.apply(this,args); };
let calls=0; const fake=model=>{ calls++; appendFileSync(process.env.PI10_INFERENCE,'fake\\n'); const content=calls===1?[{type:'toolCall',id:'w',name:'write',arguments:{path:'created.txt',content:'created'}},{type:'toolCall',id:'e',name:'edit',arguments:{path:'edited.txt',edits:[{oldText:'before',newText:'after'}]}}]:[{type:'text',text:'offline complete'}]; const message={role:'assistant',content,api:model.api,provider:model.provider,model:model.id,usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:calls===1?'toolUse':'stop',timestamp:Date.now()}; return {result:async()=>message,async *[Symbol.asyncIterator](){yield {type:'done',reason:message.stopReason,message};}}; };
const build=sdk.AgentSession.prototype._buildRuntime; sdk.AgentSession.prototype._buildRuntime=function(...args){const result=build.apply(this,args);this.agent.streamFunction=fake;this._modelRuntime.hasConfiguredAuth=()=>true;return result}; const prompt=sdk.AgentSession.prototype.prompt; sdk.AgentSession.prototype.prompt=function(...args){if(this.agent.streamFunction!==fake)throw Error('fake stream not installed');return prompt.apply(this,args)};
`);
    const { runRole } = await import(pathToFileURL(path.join(agent, 'pi/lib/role-runner.mjs')).href);
    const policy = { allowedModels: ['openai/gpt-4o'], roles: { coder: { model: 'openai/gpt-4o', thinking: 'off', tools: ['read', 'edit', 'write'] } } };
    const native = path.join(root, 'native'), inference = path.join(root, 'inference');
    fs.writeFileSync(native, ''); fs.writeFileSync(inference, '');
    fs.writeFileSync(path.join(cwd, 'edited.txt'), 'before');
    const keys = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'COMSPEC', 'PATHEXT', 'WINDIR', 'windir'];
    const clean = Object.fromEntries(keys.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
    let launches = 0, stderr = '', stdout = '';
    const spawnImpl = (command, args, options) => {
      launches++;
      assert.equal(command, process.execPath);
      assert.equal(args[0], path.join(agent, 'pi/lib/child-runtime.mjs'));
      assert.ok(args.includes(guard), 'staged policy selects staged guard');
      const child = spawn(command, args, { ...options, env: { ...clean, PI_ROLE: options.env.PI_ROLE,
        PI_ROLE_GUARD_NONCE: options.env.PI_ROLE_GUARD_NONCE, HOME: root, USERPROFILE: root, TEMP: root, TMP: root,
        PI_CODING_AGENT_DIR: agent, PI10_NATIVE: native, PI10_INFERENCE: inference, PI_OFFLINE: '1', PI_SKIP_VERSION_CHECK: '1',
        PI_MANAGED_INSTALL_ROOT: path.resolve(path.dirname(path.dirname(entry)), '../../../../..'), PI_CODING_AGENT_SDK_PATH: entry,
        NODE_OPTIONS: `--import "${pathToFileURL(preload).href}"` } });
      child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
      return child;
    };
    const result = await runRole(policy, 'coder', 'offline', cwd, prompt, { spawnImpl }).catch(error => { throw new Error(`${error.message}: ${stderr}`); });
    assert.equal(result.guardVerified, true); assert.equal(result.runtimeVerified, true);
    assert.equal(result.text, 'offline complete');
    const events = stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
    const receipts = events.filter(event => event.type === 'pi_role_guard_ready');
    assert.equal(receipts.length, 1); assert.equal(receipts[0].role, 'coder'); assert.deepEqual(receipts[0].tools, ['edit', 'write']);
    assert.deepEqual(events.filter(event => event.type === 'tool_execution_end').map(event => [event.toolName, event.isError]), [['write', false], ['edit', false]]);
    assert.equal(fs.readFileSync(path.join(cwd, 'created.txt'), 'utf8'), 'created');
    assert.equal(fs.readFileSync(path.join(cwd, 'edited.txt'), 'utf8'), 'after');
    assert.equal(fs.readFileSync(native, 'utf8'), ''); assert.notEqual(fs.readFileSync(inference, 'utf8'), '');
    fs.rmSync(path.join(cwd, 'created.txt')); fs.writeFileSync(path.join(cwd, 'edited.txt'), 'before');
    fs.writeFileSync(inference, ''); stderr = ''; stdout = '';
    fs.writeFileSync(guard, 'export default function () {}\n');
    await assert.rejects(runRole(policy, 'coder', 'offline', cwd, prompt, { spawnImpl }), /Missing guard receipt before completion/);
    assert.match(stderr, /Guard proof invalid edit definition/);
    assert.equal(launches, 2); assert.equal(fs.readFileSync(native, 'utf8'), ''); assert.equal(fs.readFileSync(inference, 'utf8'), '');
    assert.equal(fs.existsSync(path.join(cwd, 'created.txt')), false); assert.equal(fs.readFileSync(path.join(cwd, 'edited.txt'), 'utf8'), 'before');
    assert.doesNotMatch(stdout, /pi_role_guard_ready|tool_execution_start/);
    fs.writeFileSync(guard, healthy);
    rollbackPreview(staged); staged = undefined;
    assert.deepEqual(snapshot(agent).filter(([name]) => name !== 'pi-retained' && !name.startsWith(`pi-retained${path.sep}`)), before);
    assert.equal(fs.existsSync(path.join(root, 'backup')), false);
  } finally {
    if (staged) (await release()).rollbackPreview(staged);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('PI10 unstaged relative import refuses before any preview write', async () => {
  const root = sandbox(), control = sandbox();
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'pi10-preview-source-'));
  try {
    const { stagePreview, rollbackPreview } = await release();
    const healthy = stagePreview({ sourceRoot, sandboxRoot: control });
    for (const item of healthy.manifest.filter(item => !item.source.startsWith('synthetic:'))) {
      const target = path.join(fixture, item.source);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, item.source), target);
    }
    rollbackPreview(healthy);
    fs.appendFileSync(path.join(fixture, 'pi/lib/child-runtime.mjs'), "\nimport './pi10-unstaged.mjs';\n");
    assert.equal(fs.existsSync(path.join(fixture, 'pi/lib/pi10-unstaged.mjs')), false);
    const before = snapshot(root);
    assert.throws(() => stagePreview({ sourceRoot: fixture, sandboxRoot: root }), /Unstaged relative import: pi\/lib\/child-runtime\.mjs -> pi\/lib\/pi10-unstaged\.mjs/);
    assert.deepEqual(snapshot(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(control, { recursive: true, force: true });
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('preview stages child recorder and its complete import closure without parent activation', async () => {
  const root = sandbox();
  try {
    const { stagePreview, rollbackPreview } = await release();
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const start = 'pi/extensions/auditor-recorder.ts';
    const settings = JSON.parse(fs.readFileSync(path.join(staged.destination, 'settings.json'), 'utf8'));
    assert.ok(!settings.extensions.includes(start));
    const visited = new Set(), pending = [start];
    while (pending.length) {
      const rel = pending.pop(); if (visited.has(rel)) continue; visited.add(rel);
      const target = path.join(staged.destination, rel);
      assert.ok(fs.existsSync(target), `${rel} must be staged`);
      const bytes = fs.readFileSync(target);
      assert.deepEqual(bytes, fs.readFileSync(path.join(sourceRoot, rel)), rel);
      for (const match of bytes.toString('utf8').matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]|\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
        const next = path.relative(staged.destination, path.resolve(path.dirname(target), match[1] ?? match[2]));
        assert.ok(next && next !== '..' && !next.startsWith(`..${path.sep}`) && !path.isAbsolute(next));
        pending.push(next.split(path.sep).join('/'));
      }
    }
    for (const rel of ['pi/lib/auditor-recorder.mjs', 'pi/lib/role-ownership.mjs', 'pi/lib/todo-ownership.mjs', 'pi/lib/verdict.mjs']) assert.ok(visited.has(rel), `${rel} traversed`);
    rollbackPreview(staged);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('isolated preview stages the concierge guard dependency used by the selected guard extension', async () => {
  const root = sandbox();
  try {
    const { stagePreview, rollbackPreview } = await release();
    const handle = stagePreview({ sourceRoot, sandboxRoot: root });
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/concierge-guard.mjs')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/agents/council-perspectives.md')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/council-evidence.mjs')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/council-perspective.mjs')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/council-session.mjs')));
    for (const lib of ['pi/lib/job-manager.mjs', 'pi/lib/explorer-jobs.mjs', 'pi/lib/audit-evidence.mjs']) {
      assert.ok(fs.existsSync(path.join(handle.destination, lib)), `${lib} must be staged: role-agent.ts imports it`);
    }
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/job-budget.mjs')), 'job budget module must be staged');
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/expensive-gate.mjs')), 'expensive gate module must be staged');
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/agents/council-synthesis.md')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/prompts/council.md')));
    for (const lib of ['read-intercept', 'bulk-admission', 'role-policy', 'pricing', 'verdict']) {
      assert.ok(fs.existsSync(path.join(handle.destination, `pi/lib/${lib}.mjs`)), `${lib} must be staged: guard.ts imports it`);
    }
    // The staged guard must actually load from the staged tree (a missing dependency would throw here).
    const stagedGuard = await import(pathToFileURL(path.join(handle.destination, 'pi/extensions/guard.ts')).href);
    const events = new Map(); stagedGuard.default({ on: (name, fn) => events.set(name, fn) });
    assert.equal(typeof events.get('tool_call'), 'function');
    rollbackPreview(handle);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('PI-4 preview stages exact job dependencies and loads the budget-denying job tool', async (t) => {
  const sdkPath = process.env.PI_CODING_AGENT_SDK_PATH;
  if (!sdkPath) return t.skip('Set PI_CODING_AGENT_SDK_PATH for Pi runtime discovery');
  const root = sandbox();
  const previous = process.env.PI_ROLE_POLICY_PATH;
  let staged;
  try {
    const agent = path.join(root, 'agent');
    fs.mkdirSync(agent);
    fs.writeFileSync(path.join(agent, 'prior.txt'), 'pre-existing sandbox state');
    const before = snapshot(agent);
    const { stagePreview, rollbackPreview } = await release();
    staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    for (const relative of ['pi/extensions/role-agent.ts', 'pi/lib/job-manager.mjs', 'pi/lib/explorer-jobs.mjs',
      'pi/lib/audit-evidence.mjs', 'pi/lib/job-budget.mjs', 'pi/lib/expensive-gate.mjs',
      'pi/lib/role-policy.mjs', 'pi/lib/role-runner.mjs', 'pi/lib/council-evidence.mjs',
      'pi/lib/council-perspective.mjs', 'pi/lib/council-session.mjs',
      'pi/agents/explorer.md', 'pi/agents/strategist.md', 'pi/agents/auditor.md']) {
      assert.equal(hash(path.join(staged.destination, relative)), hash(path.join(sourceRoot, relative)), relative);
    }
    const policyPath = path.join(root, 'policy.json');
    fs.copyFileSync(path.join(sourceRoot, 'tests/fixtures/pi-role-policy.json'), policyPath);
    process.env.PI_ROLE_POLICY_PATH = policyPath;
    const { DefaultResourceLoader } = await import(pathToFileURL(sdkPath).href);
    const loader = new DefaultResourceLoader({ cwd: root, agentDir: staged.destination, noExtensions: true,
      additionalExtensionPaths: [path.join(staged.destination, 'pi/extensions/role-agent.ts')] });
    await loader.reload();
    const loaded = loader.getExtensions();
    assert.deepEqual(loaded.errors, []);
    const extension = loaded.extensions[0];
    assert.ok(extension.tools.has('pi_role_agent'));
    assert.ok(extension.tools.has('pi_council'));
    const tool = extension.tools.get('pi_explorer_job')?.definition;
    assert.ok(tool, 'strategist-only eligible policy must register the staged job tool');
    const context = { cwd: root };
    assert.match((await tool.execute('status', { action: 'status' }, undefined, undefined, context)).content[0].text, /No jobs/);
    await assert.rejects(tool.execute('start', { action: 'start', task: 'fixture', role: 'strategist' },
      undefined, undefined, context), /job budget is not configured/);
    assert.match((await tool.execute('status2', { action: 'status' }, undefined, undefined, context)).content[0].text, /No jobs/);
    rollbackPreview(staged);
    staged = undefined;
    assert.deepEqual(snapshot(agent).filter(([name]) => name !== 'pi-retained' && !name.startsWith(`pi-retained${path.sep}`)), before, 'PI-4 staged runtime rollback restores prior sandbox bytes');
    assert.equal(fs.existsSync(path.join(root, 'backup')), false);
  } finally {
    if (previous === undefined) delete process.env.PI_ROLE_POLICY_PATH; else process.env.PI_ROLE_POLICY_PATH = previous;
    if (staged) (await release()).rollbackPreview(staged);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('isolated preview stages the explorer prompt unchanged and excludes retired concierge resources', async () => {
  const root = sandbox();
  try {
    const { stagePreview, rollbackPreview } = await release();
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const explorer = 'pi/agents/explorer.md';
    const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.ok(fs.existsSync(path.join(staged.destination, explorer)), 'staged explorer prompt is present');
    assert.equal(hash(path.join(staged.destination, explorer)), hash(path.join(sourceRoot, explorer)));
    assert.ok(fs.existsSync(path.join(staged.destination, 'pi/lib/concierge-guard.mjs')), 'retained guard is present');
    for (const retired of ['pi/agents/concierge.md', 'pi/lib/concierge-evidence.mjs']) {
      assert.equal(fs.existsSync(path.join(staged.destination, retired)), false, `${retired} is absent`);
    }
    rollbackPreview(staged);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fresh disposable Pi consumer sees explorer roles and only its selected plugin', async () => {
  const root = sandbox();
  const launcher = path.join(os.homedir(), '.pi/agent/bin/pi-launcher.js');
  assert.ok(fs.existsSync(launcher), 'installed Pi CLI required for T16 resource smoke');
  let staged;
  try {
    const { stagePreview, rollbackPreview } = await release();
    staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const opted = path.join(root, 'opted');
    const control = path.join(root, 'control');
    fs.mkdirSync(path.join(opted, '.pi'), { recursive: true });
    fs.mkdirSync(control);
    fs.writeFileSync(path.join(opted, '.pi/settings.json'), JSON.stringify({ packages: [{
      source: path.join(sourceRoot, 'optional_plugins/manuscript'),
      skills: ['skills/manuscript-review/SKILL.md'], extensions: [], prompts: [], themes: [],
    }] }));
    const policy = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'tests/fixtures/pi-role-policy.json'), 'utf8'));
    policy.roles.explorer = { model: policy.roles.strategist.model, thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] };
    const policyPath = path.join(root, 'policy.json');
    fs.writeFileSync(policyPath, JSON.stringify(policy));
    const env = { ...process.env, PI_CODING_AGENT_DIR: staged.destination,
      PI_ROLE_POLICY_PATH: policyPath,
      PI_OFFLINE: '1', PI_TELEMETRY: '0' };
    const run = (cwd) => {
      const result = spawnSync(process.execPath,
        [launcher, '--mode', 'rpc', '--no-session', '--offline', '--no-mcp', '--approve'],
        { cwd, env, input: '{"type":"get_commands","id":"probe"}\n{"type":"prompt","message":"/pi-roles","id":"roles"}\n', encoding: 'utf8', timeout: 20000 });
      assert.equal(result.status, 0, result.stderr);
      const response = result.stdout.split(/\r?\n/).filter(Boolean).map(JSON.parse)
        .find(event => event.id === 'probe' && event.type === 'response');
      assert.ok(response?.success, result.stdout + result.stderr);
      const events = result.stdout.split(/\r?\n/).filter(Boolean).map(JSON.parse);
      assert.ok(events.some(event => event.id === 'roles' && event.type === 'response' && event.success), 'pi-roles command succeeded');
      assert.ok(events.some(event => event.type === 'extension_ui_request' && event.method === 'notify' &&
        /explorer:.*tools: read, grep, find, ls/.test(event.message) && !/concierge:/.test(event.message)),
      'pi-roles shows explorer and no concierge');
      return response.data.commands.map(item => item.name);
    };
    const enabled = run(opted);
    assert.ok(enabled.includes('pi-roles'), 'staged role extension');
    assert.ok(enabled.includes('blueprint'), 'staged Pi prompt');
    assert.ok(enabled.includes('skill:manuscript-review'), 'project-selected first-party skill');
    assert.equal(run(control).includes('skill:manuscript-review'), false);
    rollbackPreview(staged);
    staged = undefined;
  } finally {
    if (staged) (await release()).rollbackPreview(staged);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('staging rejects a dangling backup junction before copying or overwriting it', async () => {
  const root = sandbox();
  const link = path.join(root, 'backup');
  fs.symlinkSync(path.join(root, 'does-not-exist'), link, 'junction');
  try {
    const { stagePreview } = await release();
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: root }), /Symlink in isolated destination/);
    assert.equal(fs.existsSync(path.join(root, 'agent')), false);
    assert.ok(fs.lstatSync(link).isSymbolicLink());
  } finally { fs.unlinkSync(link); fs.rmSync(root, { recursive: true, force: true }); }
});

test('staging rejects a symlink child inside an otherwise isolated agent', async () => {
  const root = sandbox();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t16-child-target-'));
  const agent = path.join(root, 'agent');
  fs.mkdirSync(agent);
  const link = path.join(agent, 'linked');
  fs.symlinkSync(outside, link, 'junction');
  try {
    const { stagePreview } = await release();
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: root }), /Symlink in isolated destination/);
  } finally {
    fs.unlinkSync(link); fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('staging rejects an agent root junction before writing through it', async () => {
  const root = sandbox();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t16-outside-'));
  const link = path.join(root, 'agent');
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'outside sentinel');
  fs.symlinkSync(outside, link, 'junction');
  const before = snapshot(outside);
  try {
    const { stagePreview } = await release();
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: root }), /Symlink in isolated destination/);
    assert.deepEqual(snapshot(outside), before);
  } finally {
    fs.unlinkSync(link);
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('failed staging restores prior isolated files without leaving a backup behind', async () => {
  const root = sandbox();
  try {
    const agent = path.join(root, 'agent');
    fs.mkdirSync(agent);
    fs.writeFileSync(path.join(agent, 'keep.txt'), 'prior state');
    const before = snapshot(agent);
    const { stagePreview } = await release();
    assert.throws(() => stagePreview({ sourceRoot: root, sandboxRoot: root }));
    assert.deepEqual(snapshot(agent), before);
    assert.equal(fs.existsSync(path.join(root, 'backup')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Pi preview refuses an unmarked destination and a backup it did not create', async () => {
  const unmarked = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t16-unmarked-'));
  const root = sandbox();
  try {
    const { stagePreview } = await release();
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: unmarked }));
    assert.equal(fs.readdirSync(unmarked).length, 0);
    fs.mkdirSync(path.join(root, 'backup'));
    fs.writeFileSync(path.join(root, 'backup/keep.txt'), 'existing backup');
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: root }), /existing.*backup/i);
    assert.equal(fs.readFileSync(path.join(root, 'backup/keep.txt'), 'utf8'), 'existing backup');
    assert.equal(fs.existsSync(path.join(root, 'agent')), false);
  } finally {
    fs.rmSync(unmarked, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback restores the prior isolated agent directory byte-for-byte', async () => {
  const root = sandbox();
  try {
    const agent = path.join(root, 'agent');
    fs.mkdirSync(path.join(agent, 'notes'), { recursive: true });
    fs.writeFileSync(path.join(agent, 'AGENTS.md'), Buffer.from([0, 255, 65]));
    fs.writeFileSync(path.join(agent, 'settings.json'), '{"old":true}\n');
    fs.writeFileSync(path.join(agent, 'notes/keep.txt'), 'keep me');
    const before = snapshot(agent);
    const { stagePreview, rollbackPreview } = await release();
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    assert.ok(fs.existsSync(path.join(staged.destination, 'pi/agents/explorer.md')), 'rollback exercised after explorer staging');
    assert.notDeepEqual(snapshot(agent), before);
    rollbackPreview(staged);
    assert.deepEqual(snapshot(agent).filter(([name]) => name !== 'pi-retained' && !name.startsWith(`pi-retained${path.sep}`)), before);
    assert.equal(fs.existsSync(path.join(root, 'backup')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('isolated Pi preview backs up prior agent files and stages only Pi resources', async () => {
  const root = sandbox();
  try {
    const agent = path.join(root, 'agent');
    fs.mkdirSync(agent);
    fs.writeFileSync(path.join(agent, 'AGENTS.md'), 'PREVIOUS_AGENT_INSTRUCTIONS\n');
    const { stagePreview } = await release();
    const result = stagePreview({ sourceRoot, sandboxRoot: root });
    assert.equal(result.destination, agent);
    assert.equal(fs.readFileSync(path.join(root, 'backup/AGENTS.md'), 'utf8'), 'PREVIOUS_AGENT_INSTRUCTIONS\n');
    const guidance = fs.readFileSync(path.join(agent, 'AGENTS.md'), 'utf8');
    assert.match(guidance, /Pi AI OS/);
    assert.equal(guidance, fs.readFileSync(path.join(sourceRoot, 'Pi-global.md'), 'utf8'));
    assert.doesNotMatch(guidance, /This file is \*\*source\*\*, not an installed Pi instruction/);
    const settings = JSON.parse(fs.readFileSync(path.join(agent, 'settings.json'), 'utf8'));
    assert.equal(settings.extensions.includes('pi/extensions/role-guard.ts'), false,
      'the child-only role guard must not be loaded by the parent');
    assert.deepEqual(settings.extensions, [
      'pi/extensions/guard.ts', 'pi/extensions/session-observability.ts', 'pi/extensions/role-agent.ts',
    ]);
    assert.equal(settings.packages?.length ?? 0, 0);
    assert.ok(fs.existsSync(path.join(agent, 'pi/license-gate.json')));
    assert.equal(fs.existsSync(path.join(agent, 'hooks')), false, 'Pi 1.4.0 warns on any hooks/ directory');
    assert.equal(fs.readFileSync(path.join(agent, 'pi/agents/scribe.md'), 'utf8'),
      fs.readFileSync(path.join(sourceRoot, 'pi/agents/scribe.md'), 'utf8'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
