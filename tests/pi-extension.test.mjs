import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
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

test('Pi loads the pilot extension and exposes its role-policy command without a model call',
  { skip: !available }, () => {
    const command = process.platform === 'win32' ? process.execPath : 'pi';
    const prefix = process.platform === 'win32' ? [launcher] : [];
    const result = spawnSync(command,
      [...prefix, '--offline', '--no-session', '--mode', 'rpc', '-e', './pi/extensions/role-agent.ts'],
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
