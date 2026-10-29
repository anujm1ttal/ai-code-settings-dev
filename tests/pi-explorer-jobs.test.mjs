import assert from 'node:assert/strict';
import fs, { readFileSync } from 'node:fs';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerExplorerJobs } from '../pi/lib/explorer-jobs.mjs';
import { createExpensiveGate } from '../pi/lib/expensive-gate.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Identity-style schema builder: the tests inspect behavior, not TypeBox internals.
const Type = new Proxy({}, { get: (_t, kind) => (...args) => ({ kind, args }) });
const usage = (total) => ({ input: total, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: total,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } });
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup({ explorer = true, strategist = false, auditor = false, accessImpl = () => {}, promptPaths, defaultAccess = false,
  jobBudget = { perJobUsd: 1, perSessionUsd: 3, rates: { 'pilot-gpt/luna': { inputPerMTok: 2, outputPerMTok: 4 } } }, gate = createExpensiveGate() } = {}) {
  const tools = new Map();
  const handlers = new Map();
  const pi = { registerTool: (def) => tools.set(def.name, def), on: (name, handler) => handlers.set(name, handler) };
  const runs = [];
  const runRoleImpl = (policy, role, task, cwd, promptPath, options) => new Promise((resolve, reject) => {
    const run = { policy, role, task, cwd, promptPath, options, resolve, reject };
    options.signal.addEventListener('abort', () => { run.aborted = true; }, { once: true });
    runs.push(run);
  });
  const binding = { model: 'pilot-gpt/luna', thinking: 'medium', tools: ['read', 'grep', 'find', 'ls'] };
  const policy = { jobBudget, roles: { ...(explorer ? { explorer: binding } : {}),
    ...(strategist ? { strategist: binding } : {}), ...(auditor ? { auditor: binding } : {}) } };
  registerExplorerJobs(pi, { Type, policy, gate, promptPath: '/src/agents/explorer.md', promptPaths,
    ...(defaultAccess ? {} : { accessImpl }), invocation: { command: 'pi', args: [] }, runRoleImpl });
  const call = (params, { id = `tc-${Math.random()}`, signal, cwd = '/project' } = {}) =>
    tools.get('pi_explorer_job').execute(id, params, signal, undefined, { cwd });
  return { tools, handlers, runs, call, policy };
}
const result = (text = 'Source: a.mjs:1', total = 7) => ({ role: 'explorer', model: 'pilot-gpt/luna',
  thinking: 'medium', text, usage: usage(total), toolCounts: { read: 1 }, successfulReads: 1 });

test('registers the job tool and exactly the two lifecycle hooks only when an eligible role is configured', () => {
  const on = setup();
  assert.deepEqual([...on.tools.keys()], ['pi_explorer_job']);
  assert.deepEqual([...on.handlers.keys()].sort?.() ?? [], ['session_shutdown', 'session_tree'].sort());
  const off = setup({ explorer: false });
  assert.equal(off.tools.size, 0);
  assert.equal(off.handlers.size, 0);
});

test('start returns a job id without waiting and runs the pinned explorer with a job-owned signal', async () => {
  const { call, runs } = setup();
  const parent = new AbortController();
  const out = await call({ action: 'start', task: 'Find callers' }, { signal: parent.signal, cwd: '/proj' });
  assert.match(out.details.job.id, /^job-/);
  assert.equal(out.details.job.state, 'running');
  assert.match(out.content[0].text, /job-/);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].role, 'explorer');
  assert.equal(runs[0].task, 'Find callers');
  assert.equal(runs[0].cwd, '/proj');
  assert.equal(runs[0].promptPath, '/src/agents/explorer.md');
  assert.notEqual(runs[0].options.signal, parent.signal);
  parent.abort();
  await tick();
  assert.equal(runs[0].aborted, undefined, 'parent tool-call abort after admission must not cancel the job');
});

test('an already-aborted start call launches nothing', async () => {
  const { call, runs } = setup();
  await assert.rejects(call({ action: 'start', task: 'x' }, { signal: AbortSignal.abort() }), /abort/i);
  assert.equal(runs.length, 0);
});

test('collect reports not ready, then the result with usage on the tool result exactly once', async () => {
  const { call, runs } = setup();
  const { details: { job } } = await call({ action: 'start', task: 'Explore' });
  const early = await call({ action: 'collect', jobId: job.id });
  assert.equal(early.details.ready, false);
  assert.equal(early.usage, undefined);
  runs[0].resolve(result('Cited answer', 21));
  await tick();
  const first = await call({ action: 'collect', jobId: job.id });
  assert.match(first.content[0].text, /Cited answer/);
  assert.equal(first.usage.totalTokens, 21);
  assert.equal(first.details.model, 'pilot-gpt/luna');
  const second = await call({ action: 'collect', jobId: job.id });
  assert.match(second.content[0].text, /Cited answer/);
  assert.equal(second.usage, undefined, 'usage must not be reported twice');
  const status = await call({ action: 'status', jobId: job.id });
  assert.equal(JSON.stringify(status).includes('Cited answer'), false);
});

test('a failed job collects as an error result with unknown usage', async () => {
  const { call, runs } = setup();
  const { details: { job } } = await call({ action: 'start', task: 'Explore' });
  runs[0].reject(new Error('Explorer attempted bash tool'));
  await tick();
  const out = await call({ action: 'collect', jobId: job.id });
  assert.match(out.content[0].text, /failed|Explorer attempted bash/i);
  assert.equal(out.details.usageUnknown, true);
  assert.equal(out.usage, undefined);
});

test('cancel stops one job; a third concurrent start is rejected before launching', async () => {
  const { call, runs } = setup();
  const a = await call({ action: 'start', task: 'a' });
  await call({ action: 'start', task: 'b' });
  await assert.rejects(call({ action: 'start', task: 'c' }), /limit/i);
  assert.equal(runs.length, 2);
  const cancelled = await call({ action: 'cancel', jobId: a.details.job.id });
  assert.equal(cancelled.details.job.state, 'cancelling');
  assert.equal(runs[0].aborted, true);
  assert.equal(runs[1].aborted, undefined);
});

test('repeating the same tool-call id never launches a second child', async () => {
  const { call, runs } = setup();
  const first = await call({ action: 'start', task: 'x' }, { id: 'tc-dup' });
  const again = await call({ action: 'start', task: 'x' }, { id: 'tc-dup' });
  assert.equal(again.details.job.id, first.details.job.id);
  assert.equal(runs.length, 1);
});

test('duplicate start bypasses unreadable prompt and changed role or evidence', async (t) => {
  const f = auditFixture(t); let readable = true;
  const { call, runs } = setup({ auditor: true, promptPaths: { auditor: '/audit' },
    accessImpl: () => { if (!readable) throw new Error('prompt unreadable'); } });
  const params = { action: 'start', task: 'review', role: 'auditor', evidencePath: f.manifest, evidenceSha256: f.sha };
  const first = await call(params, { id: 'same', cwd: f.root });
  readable = false; fs.writeFileSync(f.capture, 'changed');
  const second = await call({ action: 'start', role: 'bad', evidencePath: 'bad' }, { id: 'same', cwd: f.root });
  assert.equal(second.details.job.id, first.details.job.id);
  assert.equal(runs.length, 1);
  await assert.rejects(call(params, { id: 'new', cwd: f.root }), /prompt unreadable/);
});

test('duplicate auditor call bypasses changed evidence when its prompt remains readable', async (t) => {
  const f = auditFixture(t);
  const { call, runs } = setup({ auditor: true, promptPaths: { auditor: '/audit' } });
  const params = { action: 'start', task: 'review', role: 'auditor', evidencePath: f.manifest, evidenceSha256: f.sha };
  const first = await call(params, { id: 'same-evidence', cwd: f.root });
  fs.writeFileSync(f.capture, 'changed');
  const again = await call(params, { id: 'same-evidence', cwd: f.root });
  assert.equal(again.details.job.id, first.details.job.id);
  await assert.rejects(call(params, { id: 'new-evidence', cwd: f.root }), /sha|digest/i);
  assert.equal(runs.length, 1);
});

test('without a budget strategist is denied and explorer remains available without budget status', async () => {
  const { call, runs } = setup({ strategist: true, jobBudget: null, promptPaths: { strategist: '/plan' } });
  await assert.rejects(call({ action: 'start', task: 'plan', role: 'strategist' }), /job budget is not configured/);
  assert.equal(runs.length, 0);
  await call({ action: 'start', task: 'explore' });
  const status = await call({ action: 'status' });
  assert.equal(status.details.budget, undefined);
  assert.doesNotMatch(status.content[0].text, /Budget:/);
  assert.equal(runs.length, 1);
});

test('status reports budget and collect reports cost including unknown and over budget', async () => {
  const { call, runs } = setup({ strategist: true, promptPaths: { strategist: '/plan' } });
  const first = await call({ action: 'start', task: 'plan', role: 'strategist' });
  let status = await call({ action: 'status' });
  assert.match(status.content[0].text, /Budget: spent \$0\.0000, reserved \$1\.0000, remaining \$2\.0000/);
  assert.equal(status.details.budget.reservedUsd, 1);
  runs[0].resolve({ ...result(), usage: { input: 1000000, output: 0 } }); await tick();
  const collected = await call({ action: 'collect', jobId: first.details.job.id });
  assert.match(collected.content[0].text, /Cost: \$2\.0000.*OVER the per-job budget/);
  assert.deepEqual(collected.details.cost, { usd: 2, overBudget: true });
  const next = await call({ action: 'start', task: 'plan', role: 'strategist' });
  runs[1].reject(new Error('failed')); await tick();
  assert.match((await call({ action: 'collect', jobId: next.details.job.id })).content[0].text, /Cost: unknown, remains reserved/);
});

test('session_shutdown cancels and awaits every job, then refuses new starts', async () => {
  const { call, runs, handlers } = setup();
  await call({ action: 'start', task: 'a' });
  let closed = false;
  const closing = handlers.get('session_shutdown')({ type: 'session_shutdown', reason: 'reload' }).then(() => { closed = true; });
  await tick();
  assert.equal(runs[0].aborted, true);
  assert.equal(closed, false, 'shutdown must wait for the child to settle');
  runs[0].reject(new Error('Agent dispatch aborted'));
  await closing;
  await assert.rejects(call({ action: 'start', task: 'b' }), /closed/i);
});

test('a successful tree navigation discards jobs and the new branch can start fresh ones', async () => {
  const { call, runs, handlers } = setup();
  const { details: { job } } = await call({ action: 'start', task: 'old branch' });
  const discarding = handlers.get('session_tree')({ type: 'session_tree', newLeafId: 'n', oldLeafId: 'o' });
  await tick();
  assert.equal(runs[0].aborted, true);
  runs[0].reject(new Error('Agent dispatch aborted'));
  await discarding;
  await assert.rejects(call({ action: 'collect', jobId: job.id }), /unknown|expired/i);
  await call({ action: 'start', task: 'new branch' });
  assert.equal(runs.length, 2);
});

test('rejects unknown actions and missing arguments without launching', async () => {
  const { call, runs } = setup();
  await assert.rejects(call({ action: 'explode' }), /action/i);
  await assert.rejects(call({ action: 'start' }), /task/i);
  await assert.rejects(call({ action: 'collect' }), /jobId|id/i);
  await assert.rejects(call({ action: 'cancel', jobId: 'job-missing' }), /unknown|expired/i);
  assert.equal(runs.length, 0);
});

test('registers for strategist or auditor even without explorer and documents role availability', () => {
  for (const options of [{ explorer: false, strategist: true }, { explorer: false, auditor: true }]) {
    const { tools, handlers } = setup(options);
    const def = tools.get('pi_explorer_job');
    assert.ok(def);
    assert.equal(handlers.size, 2);
    assert.match(`${def.label} ${def.description}`, /explorer/i);
    assert.match(`${def.label} ${def.description}`, /strategist/i);
    assert.match(`${def.label} ${def.description}`, /auditor.*evidencePath.*evidenceSha256/i);
    assert.match(def.description, /advisory/i);
    assert.match(def.description, /never.*task completion/i);
    assert.ok(def.parameters.args[0].evidencePath && def.parameters.args[0].evidenceSha256);
    assert.ok(def.parameters.args[0].role, 'role parameter is advertised');
  }
});

test('strategist runs with its own prompt and role is visible in status and collect', async () => {
  const paths = { explorer: '/src/agents/explorer.md', strategist: '/src/agents/strategist.md', auditor: '/src/agents/auditor.md' };
  const checked = [];
  const { call, runs, policy } = setup({ explorer: false, strategist: true, promptPaths: paths,
    accessImpl: (file, mode) => checked.push({ file, mode }) });
  const { details: { job } } = await call({ action: 'start', task: 'Plan', role: 'strategist' });
  assert.equal(job.role, 'strategist');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].policy, policy);
  assert.equal(runs[0].role, 'strategist');
  assert.equal(runs[0].task, 'Plan');
  assert.equal(runs[0].cwd, '/project');
  assert.equal(runs[0].promptPath, paths.strategist);
  assert.deepEqual(runs[0].options.invocation, { command: 'pi', args: [] });
  assert.deepEqual(checked, [{ file: paths.strategist, mode: (await import('node:fs')).constants.R_OK }]);
  assert.equal((await call({ action: 'status', jobId: job.id })).details.job.role, 'strategist');
  assert.equal((await call({ action: 'collect', jobId: job.id })).details.role, 'strategist');
  runs[0].resolve(result('Plan result'));
  await tick();
  const collected = await call({ action: 'collect', jobId: job.id });
  assert.equal(collected.details.role, 'strategist');
  assert.match(collected.content[0].text, /strategist/);
});

test('unconfigured and unsupported roles are rejected without launching or recording jobs', async () => {
  const { call, runs } = setup();
  for (const role of ['strategist', 'auditor', 'coder', 'toString']) {
    await assert.rejects(call({ action: 'start', task: 'x', role }), /role|configur|enabled/i);
    assert.equal(runs.length, 0);
  }
  assert.deepEqual((await call({ action: 'status' })).details.jobs, []);
});

test('auditor start requires evidence even when configured and creates no job', async () => {
  const { call, runs } = setup({ auditor: true, promptPaths: { auditor: '/src/agents/auditor.md' } });
  for (const args of [{}, { evidencePath: ' ' }, { evidencePath: '/tmp/manifest' }, { evidenceSha256: 'a'.repeat(64) }]) {
    await assert.rejects(call({ action: 'start', task: 'review', role: 'auditor', ...args }),
      /Auditor requires evidencePath and evidenceSha256/);
  }
  assert.equal(runs.length, 0);
  assert.deepEqual((await call({ action: 'status' })).details.jobs, []);
});

function auditFixture(t) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-audit-job-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'Artifacts', 'Evidence'); fs.mkdirSync(dir, { recursive: true });
  const capture = path.join(dir, 'capture'); fs.writeFileSync(capture, 'original');
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const manifest = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifest, JSON.stringify({ version: 1, captures: [{ path: capture, sha256: hash('original') }] }));
  return { root, capture, manifest, sha: hash(fs.readFileSync(manifest)) };
}

test('invalid auditor evidence and evidence on other roles are rejected before admission', async (t) => {
  const f = auditFixture(t);
  const { call, runs } = setup({ auditor: true, strategist: true, promptPaths: { auditor: '/audit', strategist: '/plan' } });
  for (const role of ['explorer', 'strategist']) for (const args of [{ evidencePath: f.manifest }, { evidenceSha256: f.sha }]) {
    await assert.rejects(call({ action: 'start', task: 'review', role, ...args }, { cwd: f.root }), /evidence parameters are auditor-only/i);
  }
  await assert.rejects(call({ action: 'start', task: 'review', role: 'auditor', evidencePath: f.manifest,
    evidenceSha256: '0'.repeat(64) }, { cwd: f.root }), /sha|digest/i);
  assert.equal(runs.length, 0);
  assert.deepEqual((await call({ action: 'status' })).details.jobs, []);
  await call({ action: 'start', task: 'explore', evidencePath: ' ', evidenceSha256: '\t' });
  assert.equal(runs.length, 1);
});

test('relative or outside-Artifacts manifest paths are rejected before admission with zero children', async (t) => {
  const f = auditFixture(t);
  const { call, runs } = setup({ auditor: true, promptPaths: { auditor: '/audit' } });
  const outside = path.join(f.root, 'outside.json'); fs.writeFileSync(outside, '{}');
  for (const evidencePath of [path.relative(f.root, f.manifest), outside, path.join(f.root, 'Artifacts-evil', 'm.json')]) {
    await assert.rejects(call({ action: 'start', task: 'review', role: 'auditor', evidencePath,
      evidenceSha256: f.sha }, { cwd: f.root }), /absolute|inside project Artifacts/i);
  }
  assert.equal(runs.length, 0);
  assert.deepEqual((await call({ action: 'status' })).details.jobs, []);
});

test('auditor validates before start, reads manifest, and reports verified evidence', async (t) => {
  const f = auditFixture(t);
  const { call, runs } = setup({ auditor: true, promptPaths: { auditor: '/audit' } });
  const { details: { job } } = await call({ action: 'start', task: 'Review', role: 'auditor',
    evidencePath: f.manifest, evidenceSha256: f.sha }, { cwd: f.root });
  assert.equal(runs[0].role, 'auditor');
  assert.equal(runs[0].options.requiredReadPath, f.manifest);
  assert.equal(runs[0].task, `Review\n\nEvidence manifest (read it first, then the captures it lists): ${f.manifest}`);
  assert.equal((await call({ action: 'status', jobId: job.id })).details.job.role, 'auditor');
  runs[0].resolve(result('PASS')); await tick();
  const out = await call({ action: 'collect', jobId: job.id });
  assert.equal(out.details.role, 'auditor');
  assert.deepEqual(out.details.evidence, { status: 'VERIFIED' });
  fs.writeFileSync(f.capture, 'changed!');
  const changed = await call({ action: 'collect', jobId: job.id });
  assert.equal(changed.details.evidence.status, 'INCOMPLETE');
  assert.match(changed.content[0].text, /^INCOMPLETE: evidence changed or became invalid after this job started \(.+\)\. This output does not apply to current evidence\./);
});

test('auditor evidence changed after completion but before first collection is incomplete', async (t) => {
  const f = auditFixture(t);
  const { call, runs } = setup({ auditor: true, promptPaths: { auditor: '/audit' } });
  const { details: { job } } = await call({ action: 'start', task: 'Review', role: 'auditor',
    evidencePath: f.manifest, evidenceSha256: f.sha }, { cwd: f.root });
  runs[0].resolve(result()); await tick(); fs.writeFileSync(f.capture, 'changed!');
  const out = await call({ action: 'collect', jobId: job.id });
  assert.equal(out.details.evidence.status, 'INCOMPLETE');
  assert.match(out.content[0].text, /^INCOMPLETE: evidence changed or became invalid after this job started/);
});

test('auditor evidence changed during run remains incomplete even if restored before collection', async (t) => {
  const f = auditFixture(t);
  const { call, runs } = setup({ auditor: true, promptPaths: { auditor: '/audit' } });
  const { details: { job } } = await call({ action: 'start', task: 'Review', role: 'auditor',
    evidencePath: f.manifest, evidenceSha256: f.sha }, { cwd: f.root });
  fs.writeFileSync(f.capture, 'changed!'); runs[0].resolve(result()); await tick();
  fs.writeFileSync(f.capture, 'original');
  const out = await call({ action: 'collect', jobId: job.id });
  assert.equal(out.details.evidence.status, 'INCOMPLETE');
  assert.match(out.content[0].text, /^INCOMPLETE:/);
});

test('auditor prompt validation occurs before evidence validation', async () => {
  const { call, runs } = setup({ auditor: true, promptPaths: { auditor: '/bad' },
    accessImpl: () => { throw new Error('prompt unreadable'); } });
  await assert.rejects(call({ action: 'start', task: 'review', role: 'auditor' }), /prompt unreadable/);
  assert.equal(runs.length, 0);
});

test('unreadable role prompt fails before admission, with a readable control', async () => {
  const paths = { explorer: '/ok', strategist: '/denied' };
  const { call, runs } = setup({ strategist: true, promptPaths: paths, accessImpl: (file) => {
    if (file === '/denied') throw new Error('prompt unreadable');
  } });
  await assert.rejects(call({ action: 'start', task: 'plan', role: 'strategist' }), /unreadable/i);
  assert.equal(runs.length, 0);
  assert.deepEqual((await call({ action: 'status' })).details.jobs, []);
  await call({ action: 'start', task: 'explore' });
  assert.equal(runs.length, 1);
  assert.equal(runs[0].promptPath, '/ok');
});

test('default filesystem prompt check rejects a missing file and accepts a readable file', async () => {
  const { call, runs } = setup({ strategist: true, defaultAccess: true,
    promptPaths: { explorer: fileURLToPath(import.meta.url), strategist: path.join(repo, 'no-such-role-prompt.md') } });
  await assert.rejects(call({ action: 'start', task: 'plan', role: 'strategist' }));
  assert.equal(runs.length, 0);
  assert.deepEqual((await call({ action: 'status' })).details.jobs, []);
  await call({ action: 'start', task: 'explore' });
  assert.equal(runs.length, 1);
});

test('empty or whitespace tasks require a task without launching', async () => {
  const { call, runs } = setup();
  for (const task of ['', '   ', '\t\n']) {
    await assert.rejects(call({ action: 'start', task }), /start requires a task/i);
  }
  assert.equal(runs.length, 0);
});

test('empty or whitespace job IDs list status and require IDs for collect and cancel', async () => {
  const { call } = setup();
  await call({ action: 'start', task: 'explore' });
  for (const jobId of ['', '   ', '\t\n']) {
    assert.equal((await call({ action: 'status', jobId })).details.jobs.length, 1);
    for (const action of ['collect', 'cancel']) {
      await assert.rejects(call({ action, jobId }), /requires a jobId/i);
    }
  }
});

test('empty or whitespace role defaults to explorer', async () => {
  const { call, runs } = setup();
  for (const role of ['', '   ']) {
    const { details: { job } } = await call({ action: 'start', task: 'explore', role });
    assert.equal(job.role, 'explorer');
    assert.equal(runs.at(-1).role, 'explorer');
  }
});

test('the role-agent extension wires the job tool and leaves the synchronous route unchanged', () => {
  const extension = readFileSync(path.join(repo, 'pi/extensions/role-agent.ts'), 'utf8');
  assert.match(extension, /registerExplorerJobs\(pi/);
  assert.match(extension, /promptPaths/);
  for (const role of ['explorer', 'strategist', 'auditor']) assert.match(extension, new RegExp(`['\"]${role}['\"]`));
  assert.match(extension, /runRole\(policy, params\.role, params\.task, ctx\.cwd/);
  assert.match(extension, /name: 'pi_role_agent'/);
  assert.match(extension, /name: 'pi_council'/);
});

// Characterization of the existing lifecycle at the registered tool and hook entry points.
// All runners are pending fakes; auditor admissions use a real, pinned temporary manifest.
for (const role of ['explorer', 'strategist', 'auditor']) {
  function lifecycleSetup(t) {
    const f = auditFixture(t);
    const gate = createExpensiveGate();
    const env = setup({ strategist: true, auditor: true, gate,
      promptPaths: { strategist: '/plan', auditor: '/audit' },
      jobBudget: { perJobUsd: 1, perSessionUsd: 100,
        rates: { 'pilot-gpt/luna': { inputPerMTok: 2, outputPerMTok: 4 } } } });
    const start = (task = 'review') => env.call({ action: 'start', task, role,
      ...(role === 'auditor' ? { evidencePath: f.manifest, evidenceSha256: f.sha } : {}) }, { cwd: f.root });
    return { ...env, gate, start };
  }

  test(`${role}: start returns within one second with a pending runner; cancel holds admission until settlement`, async (t) => {
    const { call, runs, gate, start } = lifecycleSetup(t);
    const before = performance.now();
    let watchdog;
    const { details: { job } } = await Promise.race([
      start(),
      new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error('start exceeded one second')), 1000); }),
    ]).finally(() => clearTimeout(watchdog));
    assert.ok(performance.now() - before < 1000, 'start must return within one second');
    assert.equal(runs.length, 1);
    assert.equal(runs[0].role, role);
    assert.equal((await call({ action: 'collect', jobId: job.id })).details.ready, false);
    assert.equal((await call({ action: 'cancel', jobId: job.id })).details.job.state, 'cancelling');
    assert.equal(runs[0].options.signal.aborted, true);
    if (role !== 'explorer') {
      await assert.rejects(start('blocked'), /Another expensive operation is active/);
      assert.equal(gate.active(), `background ${role} job`);
      assert.equal((await call({ action: 'status' })).details.budget.reservedUsd, 1);
    }
    assert.equal(runs.length, 1);
    await call({ action: 'start', task: 'other slot', role: 'explorer' });
    assert.equal(runs[1].options.signal.aborted, false);
    await assert.rejects(call({ action: 'start', task: 'over capacity', role: 'explorer' }), /limit/i);
    assert.equal(runs.length, 2);
    runs[0].reject(new Error('Agent dispatch aborted')); await tick();
    const collected = await call({ action: 'collect', jobId: job.id });
    assert.equal(collected.details.state, 'cancelled');
    assert.equal(collected.details.usageUnknown, true);
    if (role !== 'explorer') {
      assert.deepEqual(collected.details.cost, { unknown: true });
      assert.equal(gate.active(), undefined);
      assert.equal((await call({ action: 'status' })).details.budget.reservedUsd, 1);
    }
    await start('after cancellation');
    assert.equal(runs.length, 3);
  });

  for (const event of ['session_tree', 'session_shutdown']) {
    test(`${role}: ${event} aborts, waits, discards, and applies admission policy`, async (t) => {
      const { call, runs, handlers, gate, start } = lifecycleSetup(t);
      const { details: { job } } = await start();
      let finished = false;
      const draining = handlers.get(event)({ type: event }).then(() => { finished = true; });
      await tick();
      assert.equal(runs[0].options.signal.aborted, true);
      assert.equal(finished, false);
      await assert.rejects(start('during drain'), /closed|draining/i);
      assert.equal(runs.length, 1);
      // A success racing the drain is charged, but its result must not be exposed.
      runs[0].resolve(result('discarded', 100000)); await draining;
      await assert.rejects(call({ action: 'collect', jobId: job.id }), /unknown|expired/i);
      assert.equal(gate.active(), undefined);
      if (role !== 'explorer') {
        const budget = (await call({ action: 'status' })).details.budget;
        assert.equal(budget.spentUsd, 0.2);
        assert.equal(budget.reservedUsd, 0);
      }
      if (event === 'session_tree') {
        await start('new branch');
        assert.equal(runs.length, 2);
      } else {
        await assert.rejects(start('after shutdown'), /closed/i);
        assert.equal(runs.length, 1);
      }
    });
  }

  test(`${role}: unconfirmed cleanup survives tree discard and holds its slot and any expensive gate`, async (t) => {
    const { call, runs, handlers, gate, start } = lifecycleSetup(t);
    const { details: { job } } = await start();
    const draining = handlers.get('session_tree')({ type: 'session_tree' });
    assert.equal(runs[0].options.signal.aborted, true);
    runs[0].reject(new Error('Agent dispatch aborted; cleanup unconfirmed: child did not close'));
    await draining;
    const out = await call({ action: 'collect', jobId: job.id });
    assert.equal(out.details.state, 'failed');
    assert.equal(out.details.quarantined, true);
    if (role !== 'explorer') {
      assert.deepEqual(out.details.cost, { unknown: true });
      assert.equal((await call({ action: 'status' })).details.budget.reservedUsd, 1);
      assert.equal(gate.active(), `background ${role} job`);
      await assert.rejects(start('blocked by gate'), /Another expensive operation is active/);
    }
    await call({ action: 'start', task: 'slot control', role: 'explorer' });
    assert.equal(runs.length, 2);
    await assert.rejects(call({ action: 'start', task: 'third', role: 'explorer' }), /limit|quarantin/i);
    assert.equal(runs.length, 2);
  });

  test(`${role}: retained uncollected results block admission; collection permits oldest-first eviction`, async (t) => {
    const { call, runs, start } = lifecycleSetup(t);
    const ids = [];
    for (let i = 0; i < 16; i++) {
      const { details: { job } } = await start(`job ${i}`); ids.push(job.id);
      runs[i].resolve(result(`answer ${i}`)); await tick();
    }
    await assert.rejects(start('overflow'), /retained|uncollected|limit/i);
    assert.equal(runs.length, 16);
    const first = await call({ action: 'collect', jobId: ids[0] });
    assert.match(first.content[0].text, /answer 0/);
    if (role === 'auditor') assert.deepEqual(first.details.evidence, { status: 'VERIFIED' });
    assert.match((await call({ action: 'collect', jobId: ids[1] })).content[0].text, /answer 1/);
    await start('after collection');
    assert.equal(runs.length, 17);
    await assert.rejects(call({ action: 'status', jobId: ids[0] }), /unknown|expired/i);
    assert.match((await call({ action: 'collect', jobId: ids[1] })).content[0].text, /answer 1/);
  });
}

// Real Pi extension loader (SDK-gated like the other runtime-discovery tests). It never starts a job,
// so no child process and no model call can happen here.
test('the real Pi loader registers the job tool and only the two lifecycle hooks, and only with an eligible role',
  async (t) => {
    const sdkPath = process.env.PI_CODING_AGENT_SDK_PATH;
    if (!sdkPath) return t.skip('Set PI_CODING_AGENT_SDK_PATH for Pi runtime discovery');
    const fs = await import('node:fs');
    const os = await import('node:os');
    const { pathToFileURL } = await import('node:url');
    const { DefaultResourceLoader } = await import(pathToFileURL(sdkPath).href);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-explorer-jobs-'));
    const previous = process.env.PI_ROLE_POLICY_PATH;
    try {
      const fixture = JSON.parse(readFileSync(path.join(repo, 'tests/fixtures/pi-role-policy.json'), 'utf8'));
      const withExplorer = { ...fixture, roles: { ...fixture.roles,
        explorer: { model: 'pilot-gpt/luna', thinking: 'medium', tools: ['read', 'grep', 'find', 'ls'] } } };
      const agentDir = path.join(temp, 'agent'); const cwd = path.join(temp, 'project');
      fs.mkdirSync(agentDir); fs.mkdirSync(cwd);
      const load = async (policy) => {
        const file = path.join(temp, `policy-${Math.random().toString(16).slice(2)}.json`);
        fs.writeFileSync(file, JSON.stringify(policy));
        process.env.PI_ROLE_POLICY_PATH = file;
        const loader = new DefaultResourceLoader({ cwd, agentDir, noExtensions: true,
          additionalExtensionPaths: [path.join(repo, 'pi/extensions/role-agent.ts')] });
        await loader.reload();
        const loaded = loader.getExtensions();
        assert.deepEqual(loaded.errors, []);
        return loaded.extensions[0];
      };
      const on = await load(withExplorer);
      assert.ok(on.tools.has('pi_explorer_job'));
      assert.ok(on.tools.has('pi_role_agent') && on.tools.has('pi_council'), 'existing synchronous tools remain');
      assert.deepEqual([...on.handlers.keys()].sort(), ['session_shutdown', 'session_tree']);
      for (const forbidden of ['turn_end', 'agent_end', 'agent_settled', 'session_before_tree']) {
        assert.equal(on.handlers.has(forbidden), false, `${forbidden} must not cancel jobs`);
      }
      const def = on.tools.get('pi_explorer_job').definition;
      const ctx = { cwd };
      assert.match((await def.execute('t1', { action: 'status' }, undefined, undefined, ctx)).content[0].text, /No jobs/);
      await assert.rejects(def.execute('t2', { action: 'start' }, undefined, undefined, ctx), /task/i);
      // The explorer-less and no-eligible-role cases are covered by the fake-pi tests above: the extension reads its policy once at
      // import and Pi caches the module, so a second load in this process would reuse the first policy.
    } finally {
      if (previous === undefined) delete process.env.PI_ROLE_POLICY_PATH; else process.env.PI_ROLE_POLICY_PATH = previous;
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });
