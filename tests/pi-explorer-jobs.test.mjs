import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerExplorerJobs } from '../pi/lib/explorer-jobs.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Identity-style schema builder: the tests inspect behavior, not TypeBox internals.
const Type = new Proxy({}, { get: (_t, kind) => (...args) => ({ kind, args }) });
const usage = (total) => ({ input: total, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: total,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } });
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup({ explorer = true, strategist = false, auditor = false, accessImpl = () => {}, promptPaths, defaultAccess = false } = {}) {
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
  const policy = { roles: { ...(explorer ? { explorer: binding } : {}),
    ...(strategist ? { strategist: binding } : {}), ...(auditor ? { auditor: binding } : {}) } };
  registerExplorerJobs(pi, { Type, policy, promptPath: '/src/agents/explorer.md', promptPaths,
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
    assert.match(`${def.label} ${def.description}`, /auditor.*not.*enabled/i);
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

test('auditor start is disabled even when configured and creates no job', async () => {
  const { call, runs } = setup({ auditor: true, promptPaths: { auditor: '/src/agents/auditor.md' } });
  await assert.rejects(call({ action: 'start', task: 'review', role: 'auditor' }),
    /auditor jobs are not enabled until evidence support is added/i);
  assert.equal(runs.length, 0);
  assert.deepEqual((await call({ action: 'status' })).details.jobs, []);
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
