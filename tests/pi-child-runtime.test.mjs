import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildAgentArgs } from '../pi/lib/role-policy.mjs';

const launcher = fileURLToPath(new URL('../pi/lib/child-runtime.mjs', import.meta.url));
const fixture = `
export class SettingsManager {
  static inMemory() { return new SettingsManager(); }
  getRetryEnabled() { return true; }
  getRetrySettings() { return { enabled: true, maxRetries: 3, baseDelayMs: 123 }; }
  getProviderRetrySettings() { return { maxRetries: 4, timeoutMs: 123 }; }
  getCompactionEnabled() { return true; }
  getCompactionSettings() { return { enabled: true, reserveTokens: 123 }; }
}
export async function main(argv) {
  const s = SettingsManager.inMemory();
  console.log(JSON.stringify({ argv, retry: s.getRetrySettings(), provider: s.getProviderRetrySettings(),
    retryEnabled: s.getRetryEnabled(), compaction: s.getCompactionSettings(), compactionEnabled: s.getCompactionEnabled() }));
}
`;

function runFixture(args, source = fixture, noOpLauncher = false, extraEnv = {}, preloadSource) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-child-runtime-'));
  try {
    const module = path.join(dir, 'fake.mjs');
    const settings = path.join(dir, 'settings.json');
    writeFileSync(module, source);
    writeFileSync(settings, '{"retry":{"enabled":true,"maxRetries":9}}\n');
    const hash = () => createHash('sha256').update(readFileSync(settings)).digest('hex');
    const before = hash();
    let launchPath = launcher;
    if (noOpLauncher) {
      launchPath = path.join(dir, 'unpatched.mjs');
      writeFileSync(launchPath, `import { SettingsManager } from './fake.mjs';
const s = SettingsManager.inMemory();
console.log(JSON.stringify({ retryEnabled: s.getRetryEnabled(), retryMaxRetries: s.getRetrySettings().maxRetries,
  providerMaxRetries: s.getProviderRetrySettings().maxRetries, compactionEnabled: s.getCompactionEnabled() }));`);
    }
    const preload = path.join(dir, 'preload.mjs');
    if (preloadSource) writeFileSync(preload, preloadSource);
    const result = spawnSync(process.execPath, [...(preloadSource ? ['--import', pathToFileURL(preload).href] : []), launchPath, ...args], { encoding: 'utf8',
      env: { ...process.env, PI_CODING_AGENT_DIR: dir, PI_CHILD_RUNTIME_MODULE: module, ...extraEnv } });
    return { ...result, before, after: hash() };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

function assertEffective(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { retryEnabled: false, retryMaxRetries: 0,
    providerMaxRetries: 0, compactionEnabled: false });
  assert.equal(result.after, result.before);
}

test('effective runtime disables retries and compaction without touching disposable settings', () => {
  assertEffective(runFixture(['--print-effective-runtime']));
});

test('effective-runtime assertion rejects an unpatched no-op launcher', () => {
  const result = runFixture(['--print-effective-runtime'], fixture, true);
  assert.equal(result.status, 0, result.stderr);
  assert.throws(() => assertEffective(result), assert.AssertionError);
});

test('main sees patched getters and receives unchanged CLI argv', () => {
  const args = ['--model', 'pilot/model', '--thinking', 'high', '--tools', 'read,bash',
    '--exclude-tools', 'mcp__*', '--extension', '/guard.ts', '--append-system-prompt', '/role.md',
    '--no-session', '--no-extensions', '--mode', 'json', '--print', 'Task: fixture'];
  const result = runFixture(args);
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
  assert.deepEqual(lines[0], { type: 'pi_child_runtime', retryEnabled: false, retryMaxRetries: 0,
    providerMaxRetries: 0, compactionEnabled: false });
  const observed = lines[1];
  assert.deepEqual(observed.argv, args);
  assert.deepEqual(observed.retry, { enabled: false, maxRetries: 0, baseDelayMs: 123 });
  assert.deepEqual(observed.provider, { maxRetries: 0, timeoutMs: 123 });
  assert.equal(observed.retryEnabled, false);
  assert.deepEqual(observed.compaction, { enabled: false, reserveTokens: 123 });
  assert.equal(observed.compactionEnabled, false);
});

test('an explicitly selected Pi dist entry runs the same CLI setup before main', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-child-setup-'));
  try {
    const dist = path.join(dir, 'dist');
    mkdirSync(path.join(dist, 'cli'), { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    writeFileSync(path.join(dist, 'index.js'), fixture.replace('const s = SettingsManager.inMemory();',
      'if (process.env.TEST_CLI_SETUP !== "yes") throw Error("setup missing"); const s = SettingsManager.inMemory();'));
    writeFileSync(path.join(dist, 'cli', 'setup.js'), 'export function setupCli() { process.env.TEST_CLI_SETUP = "yes"; }');
    const result = spawnSync(process.execPath, [launcher, '--print', 'Task: fixture'], { encoding: 'utf8',
      env: { ...process.env, PI_CODING_AGENT_DIR: dir, PI_CHILD_RUNTIME_MODULE: path.join(dist, 'index.js') } });
    assert.equal(result.status, 0, result.stderr);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

for (const getter of ['getRetrySettings', 'getProviderRetrySettings', 'getRetryEnabled',
  'getCompactionEnabled', 'getCompactionSettings']) {
  test(`missing ${getter} fails closed before main`, () => {
    const source = fixture + `\ndelete SettingsManager.prototype.${getter};\n`;
    const result = runFixture(['--print', 'Task: fixture'], source);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(getter));
    assert.equal(result.stdout, '');
  });
}

// Exercise the barrier directly with a synthetic loader, including a second reload. The
// inference sentinel is reachable only after all requested reloads have returned.
function barrierFixture(mode) {
  const expected = fileURLToPath(new URL('../pi/extensions/role-guard.ts', import.meta.url));
  return fixture.replace(/export async function main\(argv\) \{[\s\S]*$/, `
const tag = Symbol.for('pi.role.guard.v1');
export class DefaultResourceLoader {
  constructor() { this.count = 0; }
  async reload() { this.count++; }
  getExtensions() {
    const mode = ${JSON.stringify(mode)};
    const def = name => ({ name, [tag]: { version: 1, role: mode === 'wrong-role' ? 'scribe' : 'coder',
      nonce: mode === 'wrong-nonce' ? 'other' : 'dispatch-nonce', guarded: true } });
    const guard = { resolvedPath: ${JSON.stringify(expected)}, tools: new Map(['edit', 'write'].map(name => [name, { definition: def(name) }])) };
    if (mode === 'unmarked' || (mode === 'reload' && this.count === 2)) guard.tools.get('write').definition = { name: 'write' };
    const extensions = [guard];
    if (mode === 'collision') extensions.push({ resolvedPath: '/other', tools: new Map([['edit', { definition: { name: 'edit' } }]]) });
    return { extensions, errors: mode === 'load-error' ? [{ message: 'synthetic load failure' }] : [] };
  }
}
export async function main() {
  const loader = new DefaultResourceLoader(); await loader.reload();
  if (${JSON.stringify(mode)} === 'reload') await loader.reload();
  console.log('INFERENCE_SENTINEL');
}`);
}

for (const [mode, cause] of [
  ['collision', /Guard proof edit collision/], ['unmarked', /Guard proof invalid write definition/],
  ['reload', /Guard proof invalid write definition/], ['load-error', /Guard proof load error: synthetic load failure/],
  ['wrong-role', /Guard proof invalid edit definition/], ['wrong-nonce', /Guard proof invalid edit definition/],
]) test(`PI10 child barrier rejects ${mode} before inference`, () => {
  const result = runFixture(['--tools', 'read,edit,write'], barrierFixture(mode), false,
    { PI_ROLE: 'coder', PI_ROLE_GUARD_NONCE: 'dispatch-nonce' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, cause);
  assert.doesNotMatch(result.stdout, /INFERENCE_SENTINEL/);
  assert.equal(result.after, result.before);
});

test('PI10 child barrier rejects a failed receipt write before inference', () => {
  const preload = `const write = process.stdout.write.bind(process.stdout); process.stdout.write = function(chunk, ...rest) {
    if (String(chunk).includes('pi_role_guard_ready')) { const cb = rest.find(x => typeof x === 'function'); queueMicrotask(() => cb(new Error('synthetic receipt write error'))); return false; }
    return write(chunk, ...rest);
  };`;
  const result = runFixture(['--tools', 'edit'], barrierFixture('healthy'), false,
    { PI_ROLE: 'coder', PI_ROLE_GUARD_NONCE: 'dispatch-nonce' }, preload);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /synthetic receipt write error/);
  assert.doesNotMatch(result.stdout, /INFERENCE_SENTINEL/);
});

test('PI10 synthetic healthy barrier reaches inference sentinel', () => {
  const result = runFixture(['--tools', 'write'], barrierFixture('healthy'), false,
    { PI_ROLE: 'coder', PI_ROLE_GUARD_NONCE: 'dispatch-nonce' });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /INFERENCE_SENTINEL/);
});

// PI-10: use the runner's default child entrypoint and managed SDK resolution, not
// PI_CHILD_RUNTIME_MODULE. A preload replaces only the provider stream; it cannot
// authorize a mutation or supply a guard-load receipt.
function pi10Dispatch(kind, role = 'coder', selected = ['write', 'edit']) {
  const entry = process.env.PI_CODING_AGENT_SDK_PATH;
  assert.ok(entry && path.isAbsolute(entry) && existsSync(entry), 'installed SDK entry required');
  const sdkRoot = path.dirname(path.dirname(entry));
  const managed = path.resolve(sdkRoot, '../../../../..');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi10-t1-'));
  try {
    const cwd = path.join(dir, 'workspace with spaces'), agent = path.join(dir, 'agent');
    const stage = path.join(dir, 'stage'); mkdirSync(cwd); mkdirSync(agent);
    cpSync(path.resolve('pi/lib'), path.join(stage, 'lib'), { recursive: true });
    mkdirSync(path.join(stage, 'extensions'));
    const guard = path.join(stage, 'extensions', 'role-guard.ts');
    const healthy = readFileSync('pi/extensions/role-guard.ts', 'utf8');
    const fixtures = {
      healthy,
      silent: 'export default function () {}\n',
      syntax: 'export default function ( {\n',
      throwing: 'export default function () { throw Error("fixture factory"); }\n',
      partial: healthy.replace('for (const definition of definitions) pi.registerTool(definition);',
        'for (const definition of definitions.filter(d => d.name === "edit")) pi.registerTool(definition);'),
      stubs: healthy,
      unmarked: `import { appendFileSync } from 'node:fs'; import { createEditToolDefinition, createWriteToolDefinition } from ${JSON.stringify(pathToFileURL(entry).href)};\nexport default function (pi) { for (const d of [createEditToolDefinition(process.cwd()), createWriteToolDefinition(process.cwd())]) { const execute=d.execute; d.execute=function(...args) { appendFileSync(process.env.PI10_NATIVE_COUNTER, d.name+'\\n'); return execute.apply(this,args); }; pi.registerTool(d); } }\n`,
    };
    assert.notEqual(fixtures.partial, healthy, 'partial fixture must actually remove write registration');
    assert.ok(fixtures.partial.includes('definitions.filter(d => d.name === "edit")'));
    if (kind !== 'absent') writeFileSync(guard, fixtures[kind]);
    if (kind === 'stubs') unlinkSync(path.join(stage, 'lib', 'role-guard-core.mjs'));
    const ownership = { version: 1, roles: { strategist: { plans: ['Artifacts/TODO.md', 'Artifacts/IMPLEMENTATION_PLAN.md'], todos: ['Artifacts/Plans/*.md'] }, coder: { residual: true, generated: [] }, auditor: { todos: ['Artifacts/Plans/*.md'] }, scribe: { docs: ['README.md', 'CHANGELOG.md', 'docs/**', 'Artifacts/DECISION_LOG.md', 'Artifacts/HANDOFF_BRIEF.md'] } }, protected: [], approvalLinePrefixes: ['**APPROVED'] };
    writeFileSync(path.join(agent, 'role-ownership.json'), JSON.stringify(ownership));
    const targets = { coder: ['created.txt', 'edited.txt'], strategist: ['Artifacts/TODO.md', 'Artifacts/IMPLEMENTATION_PLAN.md'], scribe: ['docs/created.md', 'docs/edited.md'] };
    const [createdPath, editedPath] = targets[role];
    mkdirSync(path.dirname(path.join(cwd, editedPath)), { recursive: true });
    writeFileSync(path.join(cwd, editedPath), 'before');
    const counter = path.join(dir, 'native-counter'); writeFileSync(counter, '');
    const prompt = path.join(dir, 'prompt.md'); writeFileSync(prompt, 'Offline dispatch.');
    const preload = path.join(dir, 'preload.mjs');
    writeFileSync(preload, `import { appendFileSync } from 'node:fs'; import * as sdk from ${JSON.stringify(pathToFileURL(entry).href)};
const refresh=sdk.AgentSession.prototype._refreshToolRegistry; sdk.AgentSession.prototype._refreshToolRegistry=function(...args) { for (const [name,d] of this._baseToolDefinitions) { if (['edit','write'].includes(name) && !d.__pi10Counted) { const execute=d.execute; d.execute=function(...a) { appendFileSync(process.env.PI10_NATIVE_COUNTER,name+'\\n'); return execute.apply(this,a); }; d.__pi10Counted=true; } } const result=refresh.apply(this,args); for (const name of ['edit','write']) { const d=this._toolDefinitions.get(name)?.definition; if (d?.[Symbol.for('pi.role.guard.v1')]?.nonce === process.env.PI_ROLE_GUARD_NONCE) appendFileSync(process.env.PI10_SELECTED_COUNTER,name+'\\n'); } return result; };
let calls=0; const fake=(model)=>{calls++; appendFileSync(process.env.PI10_INFERENCE_COUNTER,'fake\x5cn'); const all=[{type:'toolCall',id:'w',name:'write',arguments:{path:${JSON.stringify(createdPath)},content:'created'}},{type:'toolCall',id:'e',name:'edit',arguments:{path:${JSON.stringify(editedPath)},edits:[{oldText:'before',newText:'after'}]}}]; const content=calls===1?all.filter(x=>${JSON.stringify(selected)}.includes(x.name)):[{type:'text',text:'offline complete'}]; const message={role:'assistant',content,api:model.api,provider:model.provider,model:model.id,usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:calls===1?'toolUse':'stop',timestamp:Date.now()};return {result:async()=>message,async *[Symbol.asyncIterator](){yield {type:'done',reason:message.stopReason,message};}}};
const build=sdk.AgentSession.prototype._buildRuntime;sdk.AgentSession.prototype._buildRuntime=function(...args){const result=build.apply(this,args);this.agent.streamFunction=fake;this._modelRuntime.hasConfiguredAuth=()=>true;return result};const prompt=sdk.AgentSession.prototype.prompt;sdk.AgentSession.prototype.prompt=function(...args){if(this.agent.streamFunction!==fake)throw Error('fake stream not installed');return prompt.apply(this,args)};
`);
    const policy = { allowedModels: ['openai/gpt-4o'], roles: { [role]: { model: 'openai/gpt-4o', thinking: 'off', tools: ['read', ...selected] } } };
    const args = buildAgentArgs(policy, role, prompt, 'offline dispatch').map(x => x === path.resolve('pi/extensions/role-guard.ts') ? guard : x);
    assert.ok(args.includes(guard));
    const keys = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'COMSPEC', 'PATHEXT', 'WINDIR', 'windir'];
    const env = Object.fromEntries(keys.filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
    Object.assign(env, { HOME: dir, USERPROFILE: dir, TEMP: dir, TMP: dir, PI_CODING_AGENT_DIR: agent, PI_ROLE: role, PI_ROLE_GUARD_NONCE: 'test-nonce', PI10_NATIVE_COUNTER: counter, PI10_SELECTED_COUNTER: path.join(dir, 'selected-counter'), PI10_INFERENCE_COUNTER: path.join(dir, 'inference-counter'), PI_OFFLINE: '1', PI_SKIP_VERSION_CHECK: '1', PI_MANAGED_INSTALL_ROOT: managed, PI_CODING_AGENT_SDK_PATH: entry, NODE_OPTIONS: `--import "${pathToFileURL(preload).href}"` });
    const start = performance.now();
    const result = spawnSync(process.execPath, [path.join(stage, 'lib', 'child-runtime.mjs'), ...args], { cwd, env, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
    const elapsed = Math.round(performance.now() - start);
    const events = (result.stdout ?? '').split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const starts = events.filter(e => e.type === 'tool_execution_start').map(e => e.toolName);
    const ends = events.filter(e => e.type === 'tool_execution_end').map(e => ({ name: e.toolName, error: e.isError }));
    return { status: result.status, error: result.error?.message, stderr: result.stderr, starts, ends, elapsed,
      native: readFileSync(counter, 'utf8').trim().split('\n').filter(Boolean),
      selected: existsSync(path.join(dir, 'selected-counter')) ? readFileSync(path.join(dir, 'selected-counter'), 'utf8').trim().split('\n') : [],
      inference: existsSync(path.join(dir, 'inference-counter')) ? readFileSync(path.join(dir, 'inference-counter'), 'utf8').trim().split('\n') : [],
      created: existsSync(path.join(cwd, createdPath)) ? readFileSync(path.join(cwd, createdPath), 'utf8') : null,
      edited: readFileSync(path.join(cwd, editedPath), 'utf8') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const pi10Skip = !process.env.PI_CODING_AGENT_SDK_PATH || !existsSync(process.env.PI_CODING_AGENT_SDK_PATH)
  ? 'installed SDK entry required' : false;
test('PI10 real runRole preflight admits present silent guard but barrier refuses before inference', { skip: pi10Skip, timeout: 60000 }, async () => {
  const entry = process.env.PI_CODING_AGENT_SDK_PATH;
  const managed = path.resolve(path.dirname(path.dirname(entry)), '../../../../..');
  const root = mkdtempSync(path.join(os.tmpdir(), 'pi10-preflight-'));
  try {
    const stage = path.join(root, 'pi'), cwd = path.join(root, 'work'), agent = path.join(root, 'agent');
    cpSync(path.resolve('pi'), stage, { recursive: true }); mkdirSync(cwd); mkdirSync(agent);
    cpSync(path.resolve('hooks/license-gate.json'), path.join(stage, 'license-gate.json'));
    const guard = path.join(stage, 'extensions', 'role-guard.ts');
    const realGuard = readFileSync(guard, 'utf8');
    const marker = path.join(root, 'inference');
    const prompt = path.join(root, 'prompt.md'); writeFileSync(prompt, 'Offline fixture');
    const preload = path.join(root, 'preload.mjs');
    writeFileSync(preload, `import { appendFileSync } from 'node:fs'; import * as sdk from ${JSON.stringify(pathToFileURL(entry).href)};
      const fake = model => { appendFileSync(process.env.PI10_INFERENCE, 'fake\\n');
        const message = { role: 'assistant', content: [{type:'text',text:'offline complete'}], api:model.api, provider:model.provider, model:model.id,
          usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}, stopReason:'stop', timestamp:Date.now() };
        return { result: async () => message, async *[Symbol.asyncIterator]() { yield { type:'done', reason:'stop', message }; } }; };
      const build=sdk.AgentSession.prototype._buildRuntime; sdk.AgentSession.prototype._buildRuntime=function(...args) {
        const result=build.apply(this,args); this.agent.streamFunction=fake; this._modelRuntime.hasConfiguredAuth=()=>true; return result; };
      const prompt=sdk.AgentSession.prototype.prompt; sdk.AgentSession.prototype.prompt=function(...args) { if(this.agent.streamFunction!==fake) throw Error('fake stream not installed'); return prompt.apply(this,args); };`);
    const { runRole } = await import(pathToFileURL(path.join(stage, 'lib', 'role-runner.mjs')).href);
    const policy = { allowedModels: ['openai/gpt-4o'], roles: { coder: { model: 'openai/gpt-4o', thinking: 'off', tools: ['read', 'edit', 'write'] } } };
    const keys = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'COMSPEC', 'PATHEXT', 'WINDIR', 'windir'];
    const cleanEnv = Object.fromEntries(keys.filter(k => process.env[k] !== undefined).map(k => [k, process.env[k]]));
    let launches = 0, childStderr = '';
    const spawnImpl = (command, args, options) => {
      launches++;
      assert.equal(command, process.execPath); assert.equal(args[0], path.join(stage, 'lib', 'child-runtime.mjs'));
      assert.ok(args.includes(guard), 'unmodified policy resolves the fixture guard');
      const child = spawn(command, args, { ...options, env: { ...cleanEnv, PI_ROLE: options.env.PI_ROLE,
        PI_ROLE_GUARD_NONCE: options.env.PI_ROLE_GUARD_NONCE, HOME: root, USERPROFILE: root, TEMP: root, TMP: root,
        PI_CODING_AGENT_DIR: agent, PI10_INFERENCE: marker, PI_OFFLINE: '1', PI_SKIP_VERSION_CHECK: '1',
        PI_MANAGED_INSTALL_ROOT: managed, PI_CODING_AGENT_SDK_PATH: entry,
        NODE_OPTIONS: `--import "${pathToFileURL(preload).href}"` } });
      child.stderr.on('data', chunk => { childStderr += chunk; }); return child;
    };
    writeFileSync(guard, 'export default function () {}\n');
    await assert.rejects(runRole(policy, 'coder', 'offline', cwd, prompt, { spawnImpl }), /Missing guard receipt before completion/);
    assert.equal(launches, 1, 'real closure preflight passed and launched child');
    assert.match(childStderr, /Guard proof invalid edit definition/);
    assert.equal(existsSync(marker), false, 'silent guard reached no fake or provider inference');
    writeFileSync(guard, realGuard);
    childStderr = '';
    const result = await runRole(policy, 'coder', 'offline', cwd, prompt, { spawnImpl })
      .catch(error => { throw new Error(`${error.message}: ${childStderr}`); });
    assert.equal(result.guardVerified, true); assert.equal(result.text, 'offline complete');
    assert.equal(readFileSync(marker, 'utf8'), 'fake\n'); assert.equal(launches, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('PI10 GREEN real healthy guard reaches both tools on default child path', { skip: pi10Skip }, () => {
  const result = pi10Dispatch('healthy');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.ends, [{ name: 'write', error: false }, { name: 'edit', error: false }]);
  assert.equal(result.created, 'created'); assert.equal(result.edited, 'after');
  assert.deepEqual(result.native, [], 'healthy guarded definitions must not execute unguarded natives');
  assert.ok(result.inference.length > 0, 'offline inference counter presence control');
  assert.deepEqual([...new Set(result.selected)].sort(), ['edit', 'write'], 'registry-selected definitions retain the handshake');
  if (process.env.PI10_LATENCY) console.log(`PI10_HEALTHY_CHILD_MS=${result.elapsed}`);
});
test('PI10 GREEN native counter detects direct native executions independently of barrier', { skip: pi10Skip }, () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi10-counter-'));
  try {
    const entry = process.env.PI_CODING_AGENT_SDK_PATH;
    const code = `import { appendFileSync } from 'node:fs'; import * as sdk from ${JSON.stringify(pathToFileURL(entry).href)};
for (const [name, input] of [['write',{path:'sample.txt',content:'before'}],['edit',{path:'sample.txt',edits:[{oldText:'before',newText:'after'}]}]]) {
 const d=(name==='write'?sdk.createWriteToolDefinition:sdk.createEditToolDefinition)(process.cwd()); const execute=d.execute;
 d.execute=function(...a){appendFileSync('counter',name+'\\n');return execute.apply(this,a)};
 await d.execute('id',input,undefined,undefined,{cwd:process.cwd()}); }`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: dir, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readFileSync(path.join(dir, 'counter'), 'utf8').trim().split('\n'), ['write', 'edit']);
    assert.equal(readFileSync(path.join(dir, 'sample.txt'), 'utf8'), 'after');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
for (const kind of ['silent', 'partial', 'stubs', 'unmarked']) test(`PI10 RED ${kind} guard refuses before mutation`, { skip: pi10Skip }, () => {
  const result = pi10Dispatch(kind);
  assert.deepEqual({ starts: result.starts, native: result.native, created: result.created, edited: result.edited },
    { starts: [], native: [], created: null, edited: 'before' }, 'guard proof failure must prevent both tool executions and preserve targets');
  assert.notEqual(result.status, 0, 'missing guard proof must refuse writer startup');
  assert.match(result.stderr, /Guard proof invalid (?:edit|write) definition/);
  assert.deepEqual(result.inference, []);
});
for (const kind of ['syntax', 'throwing', 'absent']) test(`PI10 GREEN ${kind} guard is diagnosed before mutation`, { skip: pi10Skip }, () => {
  const result = pi10Dispatch(kind);
  assert.notEqual(result.status, 0, result.stderr);
  const diagnostics = { syntax: /(?:syntax|parse|unexpected|expected)/i, throwing: /fixture factory/i, absent: /(?:not found|cannot find|no such file|enoent|does not exist)/i };
  assert.match(result.stderr, diagnostics[kind]);
  assert.deepEqual(result.starts, []); assert.deepEqual(result.native, []); assert.deepEqual(result.inference, []); assert.equal(result.created, null); assert.equal(result.edited, 'before');
});
for (const role of ['coder', 'strategist', 'scribe']) for (const selected of [['edit', 'write'], ['edit'], ['write']]) {
  if (role === 'coder' && selected.length === 2) continue; // already covered above
  const label = selected.join('+');
  test(`PI10 GREEN ${role} ${label} healthy guard owned targets`, { skip: pi10Skip }, () => {
    const result = pi10Dispatch('healthy', role, selected);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.ends, ['write', 'edit'].filter(x => selected.includes(x)).map(name => ({ name, error: false })));
    assert.deepEqual(result.native, []);
    assert.equal(result.created, selected.includes('write') ? 'created' : null);
    assert.equal(result.edited, selected.includes('edit') ? 'after' : 'before');
  });
  test(`PI10 RED ${role} ${label} silent guard refuses native execution`, { skip: pi10Skip }, () => {
    const result = pi10Dispatch('silent', role, selected);
    assert.deepEqual({ starts: result.starts, native: result.native, created: result.created, edited: result.edited },
      { starts: [], native: [], created: null, edited: 'before' }, 'silent guard must refuse before native execution');
    assert.notEqual(result.status, 0, 'missing guard proof must refuse writer startup');
    assert.match(result.stderr, /Guard proof invalid edit definition/);
    assert.deepEqual(result.inference, []);
  });
}

test('fake transient and overflow controls observe patched getters', () => {
  const source = fixture.replace(/export async function main\(argv\) \{[\s\S]*$/, `
export async function main(argv) {
  const s = SettingsManager.inMemory();
  const scenario = argv[0];
  let attempts = 1;
  if (scenario === 'transient' && s.getRetrySettings().enabled && s.getRetrySettings().maxRetries > 0) attempts++;
  if (scenario === 'overflow' && s.getCompactionSettings().enabled) attempts++;
  console.log(JSON.stringify({ scenario, attempts, partial: true }));
}
`);
  for (const scenario of ['transient', 'overflow']) {
    const result = runFixture([scenario], source);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1)), { scenario, attempts: 1, partial: true });
  }
});
