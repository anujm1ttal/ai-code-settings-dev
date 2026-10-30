import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

function runFixture(args, source = fixture, noOpLauncher = false) {
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
    const result = spawnSync(process.execPath, [launchPath, ...args], { encoding: 'utf8',
      env: { ...process.env, PI_CODING_AGENT_DIR: dir, PI_CHILD_RUNTIME_MODULE: module } });
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
