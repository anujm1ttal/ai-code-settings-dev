import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { runCouncilPerspective } from '../pi/lib/council-perspective.mjs';
import { loadRolePolicy } from '../pi/lib/role-policy.mjs';

const policy = loadRolePolicy(new URL('./fixtures/pi-role-policy.json', import.meta.url));
test('three perspectives read identical SHA-256 evidence in separate read-only role calls', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-council-perspective-'));
  const dir = path.join(root, 'Artifacts', 'Temp');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'case.txt');
  fs.writeFileSync(file, 'Synthetic evidence: option A costs 2, option B costs 3.\n');
  const sha256 = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const calls = [];
  const runRoleImpl = async (_policy, role, task, cwd, _prompt, options) => {
    calls.push({ role, task, cwd, options });
    return { role, model: _policy.roles[role].model, thinking: _policy.roles[role].thinking, text: `${role} perspective`, usage: {} };
  };
  try {
    for (const perspective of ['strategist', 'coder', 'auditor']) {
      const result = await runCouncilPerspective(policy, { perspective, question: 'Which option and why?',
        evidencePath: file, evidenceSha256: sha256 }, root, '/tmp/council.md', { runRoleImpl });
      assert.equal(result.evidenceSha256, sha256);
    }
    assert.deepEqual(calls.map(call => call.role), ['strategist', 'coder', 'auditor']);
    for (const call of calls) {
      assert.equal(call.options.profile, 'council-read-only');
      assert.equal(call.options.requiredReadPath, file);
      assert.match(call.task, /SHA-256/i);
      assert.equal(call.cwd, root);
    }
    await assert.rejects(runCouncilPerspective(policy, { perspective: 'coder', question: '',
      evidencePath: file, evidenceSha256: sha256 }, root, '/tmp/council.md', { runRoleImpl }), /question|viewpoint/i);
    await assert.rejects(runCouncilPerspective(policy, { perspective: 'scribe', question: 'x',
      evidencePath: file, evidenceSha256: sha256 }, root, '/tmp/council.md', { runRoleImpl }), /perspective|viewpoint/i);
    await assert.rejects(runCouncilPerspective(policy, { perspective: 'coder', question: 'x',
      evidencePath: file, evidenceSha256: '0'.repeat(64) }, root, '/tmp/council.md', { runRoleImpl }), /SHA-256/i);
    assert.equal(calls.length, 3);
    const tamper = async (...args) => {
      const result = await runRoleImpl(...args);
      fs.writeFileSync(file, 'changed while child ran');
      return result;
    };
    await assert.rejects(runCouncilPerspective(policy, { perspective: 'auditor', question: 'x',
      evidencePath: file, evidenceSha256: sha256 }, root, '/tmp/council.md', { runRoleImpl: tamper }), /SHA-256/i);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
