import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs, { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import { loadRolePolicy } from '../pi/lib/role-policy.mjs';
import { prepareResultDir, buildEnvelope, buildIncompleteEnvelope } from '../pi/lib/result-contract.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launcher = path.join(os.homedir(), '.pi', 'agent', 'bin', 'pi-launcher.js');
const available = process.platform === 'win32'
  ? existsSync(launcher)
  : spawnSync('pi', ['--version'], { encoding: 'utf8', timeout: 5000 }).status === 0;
const privatePolicyFixture = path.join(repo, 'tests', 'fixtures', 'pi-role-policy.json');

// Execute the real extension body with only its runner and host replaced; no production seam.
async function dispatchFixture(t) {
  const sdkPath = process.env.PI_CODING_AGENT_SDK_PATH;
  if (!sdkPath || !path.isAbsolute(sdkPath) || !existsSync(sdkPath)) { t.skip('installed Pi SDK required'); return; }
  const aiPath = path.resolve(path.dirname(sdkPath), '../../pi-ai/dist/index.js');
  const { Type, validateToolArguments } = await import(pathToFileURL(aiPath).href);
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-dispatch-guard-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const policyFile = path.join(root, 'policy.json'); fs.copyFileSync(privatePolicyFixture, policyFile);
  const cwd = path.join(root, 'project'); fs.mkdirSync(cwd);
  const source = readFileSync(path.join(repo, 'pi/extensions/role-agent.ts'), 'utf8');
  const js = stripTypeScriptTypes(source).replace(/^import\s+[\s\S]*?\s+from\s+['\"][^'\"]+['\"]\s*;[ \t]*$/gm, '')
    .replace("const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');", `const sourceRoot = ${JSON.stringify(path.join(repo, 'pi'))};`)
    .replace(/export default function \(pi\s*\)/, 'function register(pi)') + '\nregister';
  const tools = new Map(), calls = [];
  const sandbox = { path, createHash, randomUUID, Type, Buffer, process: { env: { PI_ROLE_POLICY_PATH: policyFile } },
    loadRolePolicy, prepareResultDir, buildEnvelope, buildIncompleteEnvelope,
    runRole: async (...args) => { calls.push(args); return { role: args[1], text: 'control', usage: null }; },
    registerExplorerJobs: () => {}, createExpensiveGate: () => ({}), withExpensiveGate: async (_g, _r, fn) => fn() };
  runInNewContext(js, sandbox)({ registerTool: tool => tools.set(tool.name, tool), registerCommand: () => {} });
  const tool = tools.get('pi_role_agent');
  const execute = params => tool.execute('id', params, undefined, undefined, { cwd });
  const validate = params => validateToolArguments(tool, { name: tool.name, arguments: params });
  return { tool, calls, cwd, execute, validate };
}

const recordFields = { todo: 'Artifacts/TODO.md', taskId: 'T1', taskSha256: 'a'.repeat(64),
  verdictRef: 'Artifacts/.agent/pi-results/a.result', verdictSha256: 'b'.repeat(64),
  manifestPath: 'Artifacts/manifest.json', manifestSha256: 'c'.repeat(64) };

test('X02 rejects caller date before dispatch, with valid record control', async t => {
  const f = await dispatchFixture(t); if (!f) return;
  const params = { role: 'auditor', task: 'record', profile: 'record', ...recordFields };
  await assert.rejects(f.execute({ ...params, date: '2026-01-01' }),
    { message: 'Invalid record binding parameters: caller-supplied date is not allowed' });
  await assert.rejects(f.execute({ ...params, taskId: '', date: undefined }),
    { message: 'Invalid record binding parameters: caller-supplied date is not allowed' });
  assert.equal(f.calls.length, 0); assert.deepEqual(fs.readdirSync(f.cwd), []);
  await f.execute(params); assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][5].recordBinding.taskId, 'T1');
});

test('X04 rejects record-only fields without profile before dispatch', async t => {
  const f = await dispatchFixture(t); if (!f) return;
  await assert.rejects(f.execute({ role: 'coder', task: 'work', todo: recordFields.todo }),
    { message: 'Invalid record binding parameters: todo is record-only; omit it unless profile is "record"' });
  await assert.rejects(f.execute({ role: 'coder', task: 'work', profile: 'read-only',
    todo: recordFields.todo, taskId: recordFields.taskId }),
    { message: 'Invalid record binding parameters: todo, taskId are record-only; omit them unless profile is "record"' });
  for (const key of Object.keys(recordFields)) {
    await assert.rejects(f.execute({ role: 'coder', task: 'work', [key]: undefined }),
      { message: `Invalid record binding parameters: ${key} is record-only; omit it unless profile is "record"` });
  }
  assert.equal(f.calls.length, 0); assert.deepEqual(fs.readdirSync(f.cwd), []);
  await f.execute({ role: 'coder', task: 'work' });
  await f.execute({ role: 'coder', task: 'work', profile: 'read-only' });
  assert.equal(f.calls.length, 2);
});

test('record profile identifies missing and empty binding keys before dispatch', async t => {
  const f = await dispatchFixture(t); if (!f) return;
  const { taskId, ...remainingFields } = recordFields;
  const params = { role: 'auditor', task: 'record', profile: 'record', ...remainingFields };
  for (const invalid of [params, { ...params, taskId: '' }, { ...params, taskId: null }]) {
    await assert.rejects(f.execute(invalid),
      { message: 'Invalid record binding parameters: profile "record" requires non-empty taskId' });
  }
  await assert.rejects(f.execute({ ...params, todo: '' }),
    { message: 'Invalid record binding parameters: profile "record" requires non-empty todo, taskId' });
  assert.equal(f.calls.length, 0); assert.deepEqual(fs.readdirSync(f.cwd), []);
  await f.execute({ ...params, taskId }); assert.equal(f.calls.length, 1);
});

test('record binding schema descriptions identify all record-only fields', async t => {
  const f = await dispatchFixture(t); if (!f) return;
  for (const key of Object.keys(recordFields)) {
    assert.match(f.tool.parameters.properties[key].description ?? '', /Record profile only\./);
  }
});

test('X05 SDK schema rejects unknown property before execute', async t => {
  const f = await dispatchFixture(t); if (!f) return;
  const valid = { role: 'coder', task: 'work' };
  assert.throws(() => f.validate({ ...valid, surprise: 'ignored otherwise' }), /validat|propert/i);
  assert.equal(f.tool.parameters.additionalProperties, false);
  assert.equal(f.calls.length, 0); assert.deepEqual(fs.readdirSync(f.cwd), []);
  await f.execute(f.validate(valid)); assert.equal(f.calls.length, 1);
});

test('one shared expensive gate wraps synchronous expensive routes and is passed to jobs', () => {
  const extension = readFileSync(path.join(repo, 'pi/extensions/role-agent.ts'), 'utf8');
  assert.equal((extension.match(/createExpensiveGate\(\)/g) ?? []).length, 1);
  assert.match(extension, /withExpensiveGate\(gate, 'council',[\s\S]*?runCouncilSession/);
  assert.match(extension, /\['strategist', 'auditor', 'council-perspective'\]\.includes\(params\.role\)/);
  assert.match(extension, /await withExpensiveGate\(gate, params\.role, run\)/);
  assert.match(extension, /registerExplorerJobs\(pi,\s*\{[^}]*\bgate\b/);
});

test('T7 exposes a bounded council tool, not an automatic decision or write route', () => {
  const extension = readFileSync(path.join(repo, 'pi/extensions/role-agent.ts'), 'utf8');
  assert.match(extension, /name: 'pi_council'/);
  assert.match(extension, /runCouncilSession/);
  assert.match(extension, /council-synthesis\.md/);
});

test('role extension exposes an explicit council-perspective route, never a writable coder alias', () => {
  const extension = readFileSync(path.join(repo, 'pi/extensions/role-agent.ts'), 'utf8');
  assert.match(extension, /Type\.Literal\('council-perspective'\)/);
  assert.match(extension, /runCouncilPerspective/);
  assert.match(extension, /evidenceSha256/);
  assert.match(extension, /perspective/);
  const contract = readFileSync(path.join(repo, 'pi/agents/council-perspectives.md'), 'utf8');
  for (const role of ['strategist', 'coder', 'auditor']) assert.match(contract, new RegExp(role));
  assert.match(contract, /read-only/i);
});

test('role extension exposes a read-only explorer with unchanged tasks and bounded metadata', () => {
  const extension = readFileSync(path.join(repo, 'pi/extensions/role-agent.ts'), 'utf8');
  assert.match(extension, /Type\.Literal\('explorer'\)/);
  assert.match(extension, /read-only scribe, read-only explorer/);
  assert.doesNotMatch(extension, /concierge|validateConciergeEvidence/i);
  assert.match(extension, /runRole\(policy, params\.role, params\.task, ctx\.cwd/);
  assert.match(extension, /toolCounts/);
  assert.match(extension, /successfulReads/);
  const prompt = readFileSync(path.join(repo, 'pi/agents/explorer.md'), 'utf8');
  for (const pattern of [/read-only/i, /read.*grep.*find.*ls/i, /file:line/i,
    /callers/i, /imports/i, /types/i, /tests/i, /call chain/i, /coverage/i,
    /truncat/i, /not.found/i, /unresolved/i, /secrets/i, /user config/i]) {
    assert.match(prompt, pattern);
  }
});

test('role tool advertises optional read-only and record profiles', () => {
  const extension = readFileSync(path.join(repo, 'pi/extensions/role-agent.ts'), 'utf8');
  assert.match(extension, /profile:\s*Type\.Optional\(Type\.Union\(\[Type\.Literal\('read-only'\), Type\.Literal\('record'\)\]\)\)/);
});

test('role extension exposes a scribe child schema and a dedicated prompt', () => {
  const extension = readFileSync(path.join(repo, 'pi/extensions/role-agent.ts'), 'utf8');
  assert.match(extension, /Type\.Literal\('scribe'\)/);
  const prompt = readFileSync(path.join(repo, 'pi/agents/scribe.md'), 'utf8');
  assert.match(prompt, /codebase-navigator/);
  assert.match(prompt, /read-only/i);
});

test('source-only parent launch documents explicit guard loading without a global install', () => {
  const readme = readFileSync(path.join(repo, 'pi/README.md'), 'utf8');
  assert.match(readme, /pi -e \.\/pi\/extensions\/guard\.ts -e \.\/pi\/extensions\/session-observability\.ts -e \.\/pi\/extensions\/role-agent\.ts/);
});

test('Pi loads the pilot extension and exposes its role-policy command without a model call',
  { skip: !available }, () => {
    const command = process.platform === 'win32' ? process.execPath : 'pi';
    const prefix = process.platform === 'win32' ? [launcher] : [];
    const result = spawnSync(command,
      [...prefix, '--offline', '--no-session', '--mode', 'rpc', '--no-extensions',
        '-e', './pi/extensions/guard.ts', '-e', './pi/extensions/session-observability.ts',
        '-e', './pi/extensions/role-agent.ts'],
      { cwd: repo, input: '{"type":"get_commands","id":"probe"}\n',
        env: { ...process.env, PI_ROLE_POLICY_PATH: privatePolicyFixture },
        encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    const response = result.stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
      .find((event) => event.type === 'response' && event.command === 'get_commands');
    assert.ok(response?.success, result.stdout + result.stderr);
    assert.ok(response.data.commands.some((item) => item.name === 'pi-roles' && item.source === 'extension'));
    assert.doesNotMatch(result.stderr, /extension error|Cannot find|Failed to load/i);
  });

test('Pi extension refuses to load when no private role policy is specified',
  { skip: !available }, () => {
    const command = process.platform === 'win32' ? process.execPath : 'pi';
    const prefix = process.platform === 'win32' ? [launcher] : [];
    const env = { ...process.env };
    delete env.PI_ROLE_POLICY_PATH;
    const result = spawnSync(command,
      [...prefix, '--offline', '--no-session', '--mode', 'rpc', '-e', './pi/extensions/role-agent.ts'],
      { cwd: repo, input: '{"type":"get_commands","id":"probe"}\n', env,
        encoding: 'utf8', timeout: 15000 });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PI_ROLE_POLICY_PATH/);
  });
