import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { runCouncilSession } from '../pi/lib/council-session.mjs';
import { loadRolePolicy } from '../pi/lib/role-policy.mjs';

const policy = loadRolePolicy(new URL('./fixtures/pi-role-policy.json', import.meta.url));

test('bounded council collects three independent read-only viewpoints then an advisory synthesis', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-council-session-'));
  const dir = path.join(root, 'Artifacts', 'Temp');
  fs.mkdirSync(dir, { recursive: true });
  const evidencePath = path.join(dir, 'case.txt');
  fs.writeFileSync(evidencePath, 'Synthetic A=2 B=3; risk B is lower.');
  const evidenceSha256 = createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex');
  const calls = [];
  const runPerspectiveImpl = async (_policy, input, cwd, prompt, options) => {
    calls.push({ input, cwd, prompt, options });
    return { perspective: input.perspective, text: `${input.perspective} says A`, model: policy.roles[input.perspective].model,
      thinking: policy.roles[input.perspective].thinking, evidenceSha256, usage: {} };
  };
  const runRoleImpl = async (_policy, role, task, cwd, prompt, options) => {
    calls.push({ role, task, cwd, prompt, options });
    return { role, text: 'Advisory: GO\n[strategist] [coder] [auditor]. Disagreement: auditor prefers B.',
      model: policy.roles.strategist.model, thinking: 'high', usage: {} };
  };
  try {
    const result = await runCouncilSession(policy, { question: 'Choose A or B', evidencePath, evidenceSha256 },
      root, '/tmp/council-perspectives.md', '/tmp/council-synthesis.md', { runPerspectiveImpl, runRoleImpl });
    assert.deepEqual(calls.map(c => c.input?.perspective ?? c.role), ['strategist', 'coder', 'auditor', 'strategist']);
    assert.ok(calls.every(c => c.options.timeoutMs === 600000));
    assert.equal(calls[3].options.profile, 'council-read-only');
    assert.equal(calls[3].options.requiredReadPath, evidencePath);
    for (const viewpoint of ['strategist', 'coder', 'auditor']) assert.match(calls[3].task, new RegExp(`${viewpoint} says A`));
    assert.equal(result.verdict, 'GO');
    assert.equal(result.perspectives.length, 3);
    assert.equal(result.evidenceSha256, evidenceSha256);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('no synthesis on missing or tampered evidence, missing viewpoint, or oversized perspective', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-council-negative-'));
  fs.mkdirSync(path.join(root, 'Artifacts', 'Temp'), { recursive: true });
  const evidencePath = path.join(root, 'Artifacts', 'Temp', 'case.txt');
  fs.writeFileSync(evidencePath, 'Synthetic only');
  const evidenceSha256 = createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex');
  const input = { question: 'Choice?', evidencePath, evidenceSha256 };
  let synthesisCalls = 0;
  const runRoleImpl = async () => { synthesisCalls++; throw Error('should not synthesize'); };
  try {
    await assert.rejects(runCouncilSession(policy, { ...input, evidenceSha256: '0'.repeat(64) }, root, 'p', 's',
      { runRoleImpl }), /SHA-256/);
    const missing = async (_policy, call) => ({ perspective: call.perspective, text: '',
      evidenceSha256, model: policy.roles[call.perspective].model, thinking: policy.roles[call.perspective].thinking });
    await assert.rejects(runCouncilSession(policy, input, root, 'p', 's',
      { runPerspectiveImpl: missing, runRoleImpl }), /Invalid.*response/);
    const oversized = async (_policy, call) => ({ perspective: call.perspective, text: 'X'.repeat(16385),
      evidenceSha256, model: policy.roles[call.perspective].model, thinking: policy.roles[call.perspective].thinking });
    await assert.rejects(runCouncilSession(policy, input, root, 'p', 's',
      { runPerspectiveImpl: oversized, runRoleImpl }), /Invalid.*response/);
    const tamper = async (_policy, call) => {
      fs.writeFileSync(evidencePath, 'Modified');
      return { perspective: call.perspective, text: 'opinion', evidenceSha256,
        model: policy.roles[call.perspective].model, thinking: policy.roles[call.perspective].thinking };
    };
    await assert.rejects(runCouncilSession(policy, input, root, 'p', 's',
      { runPerspectiveImpl: tamper, runRoleImpl }), /SHA-256/);
    assert.equal(synthesisCalls, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('INCOMPLETE with a negated GO cannot become an advisory GO', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-council-incomplete-'));
  const evidencePath = path.join(root, 'Artifacts', 'Temp', 'case.txt');
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, 'Synthetic only');
  const evidenceSha256 = createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex');
  const runPerspectiveImpl = async (_policy, call) => ({ perspective: call.perspective, text: 'opinion',
    evidenceSha256, model: policy.roles[call.perspective].model, thinking: policy.roles[call.perspective].thinking });
  try {
    await assert.rejects(runCouncilSession(policy, { question: 'Choice?', evidencePath, evidenceSha256 }, root, 'p', 's', {
      runPerspectiveImpl, runRoleImpl: async () => ({ role: 'strategist', model: policy.roles.strategist.model,
        thinking: 'high', text: 'INCOMPLETE, not GO. [strategist] [coder] [auditor] Disagreement: unknown.' }),
    }), /synthesis lacks.*verdict/i);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('ambiguous Advisory GO or NO-GO must not be classified as GO', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-council-ambiguous-'));
  const evidencePath = path.join(root, 'Artifacts', 'Temp', 'case.txt');
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, 'Synthetic only');
  const evidenceSha256 = createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex');
  const runPerspectiveImpl = async (_policy, call) => ({ perspective: call.perspective, text: 'opinion',
    evidenceSha256, model: policy.roles[call.perspective].model, thinking: policy.roles[call.perspective].thinking });
  try {
    await assert.rejects(runCouncilSession(policy, { question: 'Choice?', evidencePath, evidenceSha256 }, root, 'p', 's', {
      runPerspectiveImpl, runRoleImpl: async () => ({ role: 'strategist', model: policy.roles.strategist.model,
        thinking: 'high', text: 'Advisory: GO or NO-GO. [strategist] [coder] [auditor] Disagreement: unknown.' }),
    }), /synthesis lacks.*verdict/i);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('synthesis is rejected without all three citations and explicit disagreement', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-council-verdict-'));
  fs.mkdirSync(path.join(root, 'Artifacts', 'Temp'), { recursive: true });
  const evidencePath = path.join(root, 'Artifacts', 'Temp', 'case.txt');
  fs.writeFileSync(evidencePath, 'Synthetic only');
  const evidenceSha256 = createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex');
  const input = { question: 'Choice?', evidencePath, evidenceSha256 };
  const runPerspectiveImpl = async (_policy, call) => ({ perspective: call.perspective, text: 'opinion',
    evidenceSha256, model: policy.roles[call.perspective].model, thinking: policy.roles[call.perspective].thinking });
  try {
    for (const text of ['GO [strategist] [coder] Disagreement: none',
      'GO [strategist] [coder] [auditor]', 'GO [strategist] [coder] [auditor] Disagreement: none']) {
      const badText = text === 'GO [strategist] [coder] [auditor] Disagreement: none' ? 'I approve this' : text;
      await assert.rejects(runCouncilSession(policy, input, root, 'p', 's', {
        runPerspectiveImpl, runRoleImpl: async () => ({ role: 'strategist', text: badText,
          model: policy.roles.strategist.model, thinking: 'high' }),
      }), /synthesis lacks/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
