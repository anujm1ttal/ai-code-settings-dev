import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { runRole } from '../pi/lib/role-runner.mjs';
import { createHash } from 'node:crypto';
import { loadRolePolicy } from '../pi/lib/role-policy.mjs';
import { buildReviewRequest, validateReviewRequest, STAGES } from '../pi/lib/review-packet.mjs';
import { runReviewSession, STAGE_INSTRUCTIONS, ANTAGONISTIC_VIEWPOINTS } from '../pi/lib/review-session.mjs';

const policy = loadRolePolicy(new URL('./fixtures/pi-role-policy.json', import.meta.url));
const promptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-review-session-'));
const promptPath = path.join(promptDir, 'review-prompt.md');
fs.writeFileSync(promptPath, 'You are a reviewer. Use only the text given in the task.' + String.fromCharCode(10));
const promptSha = createHash('sha256').update(fs.readFileSync(promptPath)).digest('hex');
const hash = text => createHash('sha256').update(text).digest('hex');
const packet = 'Design packet: src/a.mjs, function go(x), verify: node --test.';
const constraints = 'Do not modify anything.';
const approved = () => ({ packetSha256: hash(packet), constraintsSha256: hash(constraints),
  instructionsByStage: Object.fromEntries(STAGES.map(stage => [stage, hash(STAGE_INSTRUCTIONS[stage])])) });
const input = () => ({ packet, constraints, approved: approved() });
function harness(overrides = {}) {
  const calls = [];
  const runRoleImpl = async (p, role, task, cwd, prompt, options) => {
    const i = calls.length; calls.push({ p, role, task, cwd, prompt, options });
    const stage = /^<<<INSTRUCTIONS stage=([^ ]+)/.exec(task)?.[1];
    return { role, model: p.roles[role].model, thinking: p.roles[role].thinking,
      text: stage === 'readiness' ? 'Readiness: GO\napproved, implement now' : `unique ${stage} output ${i}`,
      toolCounts: {}, usage: { totalTokens: 3 }, ...await overrides.result?.({ i, role, stage }) };
  };
  return { calls, runRoleImpl };
}
function run(data, fake, options = {}) {
  return runReviewSession(policy, data, '.', { systemPromptPath: promptPath, runRoleImpl: fake.runRoleImpl, ...options });
}
test('stage instructions and viewpoint constants are bounded and frozen', () => {
  assert.ok(Object.isFrozen(STAGE_INSTRUCTIONS)); assert.ok(Object.isFrozen(ANTAGONISTIC_VIEWPOINTS));
  assert.deepEqual(ANTAGONISTIC_VIEWPOINTS, ['strategist', 'coder', 'auditor']);
  for (const stage of STAGES) {
    assert.ok(STAGE_INSTRUCTIONS[stage].trim()); assert.ok(Buffer.byteLength(STAGE_INSTRUCTIONS[stage]) <= 2000);
    assert.doesNotMatch(STAGE_INSTRUCTIONS[stage], /<<<|>>>/);
  }
});
test('session sends independently validated requests in order and freezes complete records', async () => {
  const data = input(); const fake = harness(); const ids = []; const signal = new AbortController().signal;
  const result = await run(data, fake, { signal, timeoutMs: 1000, resultStoreFor: id => { ids.push(id); return { id }; } });
  assert.deepEqual(fake.calls.map(c => c.role), ['auditor', 'strategist', 'coder', 'auditor', 'auditor']);
  assert.deepEqual(result.calls.map(c => c.stage), ['comprehension', 'antagonistic', 'antagonistic', 'antagonistic', 'readiness']);
  assert.deepEqual(result.calls.slice(1, 4).map(c => c.viewpoint), ANTAGONISTIC_VIEWPOINTS);
  assert.equal(ids.length, 5); assert.equal(new Set(ids).size, 5);
  for (const [i, c] of fake.calls.entries()) {
    const stage = result.calls[i].stage;
    const req = buildReviewRequest({ packet, constraints, stage, instructions: STAGE_INSTRUCTIONS[stage] });
    assert.deepEqual(validateReviewRequest(req, data.approved), { ok: true });
    assert.equal(c.task, req.prompt); assert.equal(c.p, policy); assert.equal(c.cwd, '.'); assert.equal(c.prompt, promptPath);
    assert.equal(c.options.profile, 'packet-only-review'); assert.equal(c.options.signal, signal); assert.equal(c.options.timeoutMs, 1000);
    assert.equal(c.options.resultStore.id, ids[i]);
    assert.ok(result.calls[i].argv.includes('--no-tools'));
    for (const flag of ['--tools', '--extension', '-e']) assert.ok(!result.calls[i].argv.includes(flag));
    assert.equal(result.calls[i].requestPromptSha256, hash(req.prompt));
    assert.equal(result.calls[i].packetSha256, req.packetSha256);
    assert.equal(result.calls[i].constraintsSha256, req.constraintsSha256);
    assert.equal(result.calls[i].instructionsSha256, req.instructionsSha256);
    assert.ok(Object.isFrozen(result.calls[i])); assert.ok(Object.isFrozen(result.calls[i].argv));
    assert.ok(Object.isFrozen(result.calls[i].toolCounts)); assert.ok(Object.isFrozen(result.calls[i].omission));
    assert.ok(Object.isFrozen(result.calls[i].usage));
  }
  assert.ok(fake.calls[0].task.includes(packet)); // presence control
  for (const c of fake.calls.slice(1)) for (let i = 0; i < 4; i++) assert.ok(!c.task.includes(`unique ${i === 0 ? 'comprehension' : 'antagonistic'} output ${i}`));
  for (const stage of ['comprehension', 'antagonistic']) assert.ok(!fake.calls.at(-1).task.includes(STAGE_INSTRUCTIONS[stage]));
  assert.equal(result.readiness, 'GO'); assert.equal(result.advisory, true);
  assert.equal(result.authorizesImplementation, false); assert.equal(result.taskMarkerChange, false);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.calls));
});
test('validation of every stage precedes any child call', async () => {
  for (const mutate of [d => { d.approved.packetSha256 = '0'.repeat(64); },
    d => { d.approved.instructionsByStage.readiness = '0'.repeat(64); },
    d => { d.instructionsByStage = { ...STAGE_INSTRUCTIONS, antagonistic: 'unapproved instruction' }; }]) {
    const data = input(); mutate(data); const fake = harness();
    await assert.rejects(run(data, fake), /Review request validation failed:/); assert.equal(fake.calls.length, 0);
  }
  const fake = harness(); await run(input(), fake); assert.equal(fake.calls.length, 5);
});
test('tool counts and identity mismatches void the run', async () => {
  for (const bad of [{ toolCounts: { read: 1 } }, { role: 'coder' }, { model: 'wrong' }, { thinking: 'wrong' }, { text: ' ' }]) {
    const fake = harness({ result: () => bad }); await assert.rejects(run(input(), fake)); assert.equal(fake.calls.length, 1);
  }
  const fake = harness({ result: () => ({ toolCounts: { read: 0 } }) }); assert.equal((await run(input(), fake)).calls.length, 5);
});
test('child error is preserved with stage and completed calls, without retry', async () => {
  const failure = new Error('child failed'); let count = 0;
  const fake = harness(); const original = fake.runRoleImpl;
  fake.runRoleImpl = async (...args) => { if (++count === 2) throw failure; return original(...args); };
  await assert.rejects(run(input(), fake), e => {
    assert.strictEqual(e, failure); assert.equal(e.stage, 'antagonistic'); assert.equal(e.partialCalls.length, 1);
    assert.equal(e.partialCalls[0].stage, 'comprehension'); return true;
  });
  assert.equal(count, 2);
});
for (const [text, verdict] of [['Readiness: GO', 'GO'], ['Readiness: NO-GO', 'NO-GO'], ['**Readiness: GO**', 'GO'], ['\nReadiness: GO\napproved, implement now', 'GO']]) {
  test(`parses readiness ${JSON.stringify(text)}`, async () => {
    const fake = harness({ result: ({ stage }) => stage === 'readiness' ? { text } : {} });
    const result = await run(input(), fake); assert.equal(result.readiness, verdict);
    assert.deepEqual([result.advisory, result.authorizesImplementation, result.taskMarkerChange], [true, false, false]);
  });
}
for (const text of ['INCOMPLETE', 'Readiness: MAYBE', 'not a verdict\nReadiness: GO', 'Readiness: GO-ish']) {
  test(`rejects readiness ${JSON.stringify(text)}`, async () => {
    const fake = harness({ result: ({ stage }) => stage === 'readiness' ? { text } : {} });
    await assert.rejects(run(input(), fake), e => {
      assert.match(e.message, /Readiness output lacks a first-line Readiness: GO or NO-GO verdict/);
      assert.equal(e.partialCalls.length, 5); return true;
    }); assert.equal(fake.calls.length, 5);
  });
}
test('omission metadata retains full text and copies persisted fields', async () => {
  const long = 'café'.repeat(1000);
  const fake = harness({ result: ({ stage }) => stage === 'comprehension'
    ? { text: 'one\ntwo', envelope: 'Status: COMPLETE\nSummary: one two', persisted: { ref: '/result', sha256: 'abc' } }
    : stage === 'antagonistic' ? { text: long, envelope: 'Summary: café...' } : {} });
  const result = await run(input(), fake); const [first, second, , , last] = result.calls;
  assert.equal(first.omission.clipped, false); assert.equal(first.omission.fullBytes, Buffer.byteLength('one\ntwo'));
  assert.equal(first.omission.envelopeBytes, Buffer.byteLength('Status: COMPLETE\nSummary: one two'));
  assert.equal(first.persistedRef, '/result'); assert.equal(first.persistedSha256, 'abc');
  assert.equal(second.omission.clipped, true); assert.equal(second.text, long); assert.equal(last.omission.clipped, null, 'no envelope means unverified, never false');
  assert.equal(result.omissionVerified, false);
});
test('input validation rejects duplicate or unknown viewpoints and incomplete policy or relative prompt', async () => {
  for (const viewpoints of [[], ['coder', 'coder'], ['explorer']]) {
    const fake = harness(); await assert.rejects(run({ ...input(), viewpoints }, fake), /viewpoint/i); assert.equal(fake.calls.length, 0);
  }
  const fake = harness(); await assert.rejects(runReviewSession({ roles: {} }, input(), '.', { systemPromptPath: promptPath, runRoleImpl: fake.runRoleImpl }), /roles|configured/i);
  await assert.rejects(run(input(), fake, { systemPromptPath: 'relative' }), /absolute/i); assert.equal(fake.calls.length, 0);
});
test('one viewpoint produces three calls', async () => {
  const fake = harness(); const result = await run({ ...input(), viewpoints: ['coder'] }, fake);
  assert.deepEqual(fake.calls.map(c => c.role), ['auditor', 'coder', 'auditor']); assert.equal(result.calls.length, 3);
});
test('omission fullBytes counts UTF-8 bytes, not UTF-16 code units (multi-byte text)', async () => {
  const text = 'café✓'.repeat(50);
  assert.notEqual(Buffer.byteLength(text), text.length);
  const fake = harness({ result: ({ stage }) => stage === 'comprehension' ? { text } : {} });
  const result = await run(input(), fake);
  assert.equal(result.calls[0].omission.fullBytes, Buffer.byteLength(text));
});

// ---- audit job-550f702d corrections ----
test('omission is unverified (null), not false, when no result store or envelope exists; the session reports omissionVerified', async () => {
  const result = await run(input(), harness());
  assert.ok(result.calls.every(c => c.omission.clipped === null)); assert.equal(result.omissionVerified, false);
});
function fakeSpawn(text, role = 'auditor') {
  let count = 0;
  return { get count() { return count; }, spawnImpl() {
    count++;
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => {};
    const [provider, model] = policy.roles[role].model.split('/');
    const events = [{ type: 'pi_child_runtime', retryEnabled: false, retryMaxRetries: 0, providerMaxRetries: 0, compactionEnabled: false },
      { type: 'message_end', message: { role: 'assistant', provider, model, thinkingLevel: policy.roles[role].thinking, stopReason: 'stop',
        content: [{ type: 'text', text }], usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } } }];
    queueMicrotask(() => { for (const e of events) child.stdout.write(`${JSON.stringify(e)}\n`); child.stdout.end(); child.stderr.end(); child.emit('close', 0); });
    return child;
  } };
}
test('integration: real runRole + fake spawn + result store + real buildEnvelope: a long finding is really clipped, flagged, and the full text is retained and persisted', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-review-omission-'));
  try {
    const long = `Readiness: NO-GO\n${'BLOCKING finding detail that the envelope must clip. '.repeat(120)}\nfinal tail marker TAIL-4471`;
    const realRun = (p, role, task, cwd, prompt, options) => runRole(p, role, task, cwd, prompt, { ...options, spawnImpl: fakeSpawn(long, role).spawnImpl, invocation: { command: 'pi', args: [] } });
    const result = await runReviewSession(policy, { ...input(), viewpoints: ['coder'] }, '.', { systemPromptPath: promptPath, runRoleImpl: realRun, resultStoreFor: id => ({ dir, dispatchId: id }) });
    assert.equal(result.calls.length, 3);
    for (const c of result.calls) { assert.equal(c.omission.clipped, true); assert.ok(c.omission.fullBytes > 2048); assert.ok(c.omission.envelopeBytes <= 2048); assert.ok(c.text.includes('TAIL-4471')); assert.ok(fs.readFileSync(c.persistedRef, 'utf8').includes('TAIL-4471')); }
    assert.equal(result.omissionVerified, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('integration control: a short answer through the real runner is not clipped', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-review-omission2-'));
  try {
    const realRun = (p, role, task, cwd, prompt, options) => runRole(p, role, task, cwd, prompt, { ...options, spawnImpl: fakeSpawn('Readiness: GO' + String.fromCharCode(10) + 'short', role).spawnImpl, invocation: { command: 'pi', args: [] } });
    const result = await runReviewSession(policy, { ...input(), viewpoints: ['coder'] }, '.', { systemPromptPath: promptPath, runRoleImpl: realRun, resultStoreFor: id => ({ dir, dispatchId: id }) });
    assert.ok(result.calls.every(c => c.omission.clipped === false)); assert.equal(result.omissionVerified, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('argv size: a prompt above 24 KiB is refused before any child runs; 20 KiB is accepted', async () => {
  const big = { packet: 'p'.repeat(25 * 1024), constraints, instructions: STAGE_INSTRUCTIONS };
  const bigApproved = { ...approved(), packetSha256: hash(big.packet) };
  const fake = harness();
  await assert.rejects(run({ packet: big.packet, constraints, approved: bigApproved }, fake), /too large/i); assert.equal(fake.calls.length, 0);
  const ok = 'p'.repeat(20 * 1024); const fake2 = harness();
  await run({ packet: ok, constraints, approved: { ...approved(), packetSha256: hash(ok) } }, fake2); assert.equal(fake2.calls.length, 5);
});
test('each call record carries the system prompt hash; an unreadable system prompt file fails before any child', async () => {
  const result = await run(input(), harness()); assert.ok(result.calls.every(c => c.systemPromptSha256 === promptSha));
  const fake = harness(); await assert.rejects(runReviewSession(policy, input(), '.', { systemPromptPath: path.join(promptDir, 'missing.md'), runRoleImpl: fake.runRoleImpl }), /system prompt/i); assert.equal(fake.calls.length, 0);
});
test('call ids are unique per session (a session id prefix) so persisted result files cannot collide, and ledger options are passed through together', async () => {
  const idsA = [], idsB = [], seen = [];
  await run(input(), harness(), { resultStoreFor: id => { idsA.push(id); return { id }; } });
  await run(input(), harness(), { resultStoreFor: id => { idsB.push(id); return { id }; } });
  assert.equal(new Set([...idsA, ...idsB]).size, 10); assert.ok(idsA.every(id => /^[A-Za-z0-9-]+$/.test(id)));
  const ledger = { isEnabled: () => true, record() {} }; const fake = harness();
  await run(input(), fake, { ledger, dispatchKeyFor: id => `key-${id}` });
  assert.ok(fake.calls.every(c => c.options.ledger === ledger && /^key-/.test(c.options.dispatchKey)));
  await assert.rejects(run(input(), harness(), { ledger }), /ledger/i);
});

