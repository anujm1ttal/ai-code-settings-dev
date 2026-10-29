import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launcher = path.join(os.homedir(), '.pi', 'agent', 'bin', 'pi-launcher.js');
const available = process.platform === 'win32'
  ? existsSync(launcher)
  : spawnSync('pi', ['--version'], { encoding: 'utf8', timeout: 5000 }).status === 0;
const privatePolicyFixture = path.join(repo, 'tests', 'fixtures', 'pi-role-policy.json');

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
