import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/bulk-approve.mjs', import.meta.url));
const basePolicy = JSON.parse(readFileSync(new URL('./fixtures/pi-role-policy.json', import.meta.url), 'utf8'));
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'pi-approve-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const policy = { ...basePolicy, roles: { ...basePolicy.roles, explorer: { model: basePolicy.roles.coder.model, thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] } } };
  writeFileSync(path.join(root, 'policy.json'), JSON.stringify(policy)); writeFileSync(path.join(root, 'prompt.txt'), 'prompt'); writeFileSync(path.join(root, 'file.txt'), 'hello\n');
  const args = ['--root', root, '--policy', path.join(root, 'policy.json'), '--worker', policy.roles.explorer.model, '--input-rate', '1', '--output-rate', '2', '--max-output-tokens', '256', '--max-cost-usd', '0.5', '--max-total-usd', '2', '--ttl-hours', '1', '--system-prompt', path.join(root, 'prompt.txt'), 'file.txt'];
  return { root, args };
}
const run = args => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
test('CLI creates validated hash record and requires explicit replace', t => {
  const f = fixture(t); const first = run(f.args); assert.equal(first.status, 0, first.stderr);
  const target = path.join(f.root, 'Artifacts/.agent/bulk-read-approval.json'); const record = JSON.parse(readFileSync(target, 'utf8'));
  assert.deepEqual(record.approvedPaths, ['file.txt']); assert.match(record.approvedSha256['file.txt'], /^[a-f0-9]{64}$/);
  assert.equal(run(f.args).status, 1); assert.equal(readFileSync(target, 'utf8'), JSON.stringify(record, null, 2) + '\n');
  assert.equal(run([...f.args, '--replace']).status, 0);
});
test('CLI rejects invalid policy, worker, ttl, unknown options and unsafe inputs', t => {
  const f = fixture(t);
  for (const args of [ [...f.args, '--bogus'], f.args.map(x => x === '1' ? '25' : x), f.args.map(x => x === 'file.txt' ? '../file.txt' : x), f.args.map(x => x === 'file.txt' ? '.env' : x), f.args.map(x => x === 'pilot-gpt/sol' ? 'invalid/model' : x) ]) assert.notEqual(run(args).status, 0);
  mkdirSync(path.join(f.root, 'Artifacts'), { recursive: true });
  assert.throws(() => readFileSync(path.join(f.root, 'Artifacts/.agent/bulk-read-approval.json')));
});
test('CLI honours PI_ROLE_POLICY_PATH when --policy is absent', t => {
  const f = fixture(t); const i = f.args.indexOf('--policy'); const without = f.args.filter((_, j) => j !== i && j !== i + 1);
  const ok = spawnSync(process.execPath, [script, ...without], { encoding: 'utf8', env: { ...process.env, PI_ROLE_POLICY_PATH: path.join(f.root, 'policy.json') } });
  assert.equal(ok.status, 0, ok.stderr);
});
test('importing CLI does not run it or write anything', t => {
  const f = fixture(t); const result = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('../scripts/bulk-approve.mjs', import.meta.url).href)})`], { cwd: f.root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, '');
});
