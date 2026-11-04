import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { loadRolePolicy } from '../pi/lib/role-policy.mjs';
import { interceptRead, loadInterceptState } from '../pi/lib/read-intercept.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guardFile = path.join(root, 'pi/extensions/guard.ts');
const hash = data => createHash('sha256').update(data).digest('hex');
const MODELS = ['pilot/m1', 'pilot/m2', 'pilot/m3', 'pilot/m4', 'pilot/worker'];
const policy = { allowedModels: MODELS, roles: {
  strategist: { model: 'pilot/m1', thinking: 'high', tools: ['read', 'grep', 'find', 'ls'] },
  coder: { model: 'pilot/m2', thinking: 'medium', tools: ['read', 'grep', 'find', 'ls', 'bash', 'edit', 'write'] },
  auditor: { model: 'pilot/m3', thinking: 'high', tools: ['read', 'grep', 'find', 'ls'] },
  explorer: { model: 'pilot/worker', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] } },
  jobBudget: { perJobUsd: 1, perSessionUsd: 5, rates: { 'pilot/worker': { inputPerMTok: 1, outputPerMTok: 2 } } } };

// One project with an approved file, an unapproved file and a valid approval record.
function project(t, { approval = true, edit = a => a } = {}) {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-intercept-')));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'Artifacts', '.agent'), { recursive: true });
  const bytes = Buffer.from('one\ntwo\nthree\n');
  fs.writeFileSync(path.join(dir, 'a.txt'), bytes);
  fs.writeFileSync(path.join(dir, 'docs', 'b.txt'), 'bee\n');
  fs.writeFileSync(path.join(dir, 'other.txt'), 'other\n');
  const policyPath = path.join(dir, 'policy.json');
  fs.writeFileSync(policyPath, JSON.stringify(policy));
  const now = Date.now();
  const record = edit({ version: 1, approvalId: 'id', approvedAt: new Date(now - 60000).toISOString(), expiresAt: new Date(now + 3600000).toISOString(),
    worker: 'pilot/worker', rates: { inputPerMTok: 1, outputPerMTok: 2 }, maxOutputTokens: 256, maxCostUsd: 0.5, maxTotalUsd: 2,
    systemPromptSha256: hash('x'), approvedPaths: ['a.txt', 'docs/b.txt'], approvedSha256: { 'a.txt': hash(bytes), 'docs/b.txt': hash('bee\n') } });
  if (approval) fs.writeFileSync(path.join(dir, 'Artifacts', '.agent', 'bulk-read-approval.json'), JSON.stringify(record));
  return { dir, policyPath };
}

async function guard(env) {
  const previous = {};
  for (const [k, v] of Object.entries(env)) { previous[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  const events = new Map();
  const { default: register } = await import(pathToFileURL(guardFile).href);
  register({ on(name, handler) { events.set(name, handler); } });
  const call = async (toolName, input, cwd) => events.get('tool_call')({ toolName, input }, { cwd });
  const restore = () => { for (const [k, v] of Object.entries(previous)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } };
  return { call, restore };
}
async function withGuard(p, fn, extra = {}) {
  const g = await guard({ PI_ROLE: undefined, PI_ROLE_POLICY_PATH: p.policyPath, ...extra });
  try { return await fn(g.call); } finally { g.restore(); }
}
const blocked = r => r?.block === true;
// Exercise the retained library independently of the guard, reloading state on each call as before.
async function withIntercept(p, fn) {
  const call = async (toolName, input, cwd) => {
    const state = loadInterceptState({ cwd, loadPolicy: () => loadRolePolicy(p.policyPath) });
    const reason = interceptRead({ toolName, input, cwd, state });
    return reason ? { block: true, reason } : undefined;
  };
  return fn(call);
}

test('Parent whole-file read and plain cat are not redirected with a valid approval and policy', async t => {
  const p = project(t);
  const state = loadInterceptState({ cwd: p.dir, loadPolicy: () => loadRolePolicy(p.policyPath) });
  assert.ok(state, 'valid approval and absolute policy with worker rate');
  for (const [toolName, input] of [['read', { path: 'a.txt' }], ['bash', { command: 'cat a.txt' }]]) {
    assert.match(interceptRead({ toolName, input, cwd: p.dir, state }), /pi_bulk_read/, `${toolName} presence control`);
  }
  await withGuard(p, async call => {
    const results = await Promise.all([
      call('read', { path: 'a.txt' }, p.dir),
      call('bash', { command: 'cat a.txt' }, p.dir),
    ]);
    assert.deepEqual(results, [undefined, undefined], 'Parent reads must not be blocked or redirected');
  });
});

test('library redirects whole-file reads of approved files to pi_bulk_read, in every path spelling', async t => {
  const p = project(t);
  await withIntercept(p, async call => {
    const spellings = ['a.txt', './a.txt', '@a.txt', path.join(p.dir, 'a.txt'), 'docs/../a.txt', 'docs/b.txt'];
    if (process.platform === 'win32') spellings.push('docs\\b.txt');
    for (const spelling of spellings) {
      const r = await call('read', { path: spelling }, p.dir);
      assert.ok(blocked(r), spelling);
      assert.match(r.reason, /pi_bulk_read/); assert.match(r.reason, /offset/); assert.match(r.reason, /limit/);
    }
    assert.ok(blocked(await call('read', { path: 'a.txt', offset: 2 }, p.dir)), 'offset alone is not a bounded read');
    assert.ok(blocked(await call('read', { path: 'a.txt', limit: 0 }, p.dir)), 'limit 0 is not bounded');
    assert.ok(blocked(await call('read', { path: 'a.txt', limit: -5 }, p.dir)));
    assert.ok(blocked(await call('read', { path: 'a.txt', limit: '50' }, p.dir)), 'non-integer limit is not trusted');
    assert.ok(blocked(await call('read', { path: 'a.txt', limit: 1.5 }, p.dir)));
  });
});

test('library passes bounded reads, unapproved files and fragmented reads (documented bypass)', async t => {
  const p = project(t);
  await withIntercept(p, async call => {
    assert.equal(await call('read', { path: 'a.txt', limit: 50 }, p.dir), undefined);
    assert.equal(await call('read', { path: 'a.txt', offset: 1, limit: 2 }, p.dir), undefined);
    // Fragmented reads are NOT detected: three bounded reads reassemble the whole file.
    for (const offset of [1, 2, 3]) assert.equal(await call('read', { path: 'a.txt', offset, limit: 1 }, p.dir), undefined);
    assert.equal(await call('read', { path: 'other.txt' }, p.dir), undefined);
    assert.equal(await call('read', { path: 'missing.txt' }, p.dir), undefined);
    assert.equal(await call('read', { path: 'docs' }, p.dir), undefined);
    assert.equal(await call('read', {}, p.dir), undefined);
    assert.equal(await call('read', { path: 5 }, p.dir), undefined);
    assert.equal(await call('grep', { pattern: 'x', path: 'a.txt' }, p.dir), undefined);
  });
});

test('library does not intercept without a valid approval; guard reads pass regardless of policy path', async t => {
  const bad = [
    ['absent', project(t, { approval: false })],
    ['expired', project(t, { edit: a => ({ ...a, approvedAt: new Date(Date.now() - 7200000).toISOString(), expiresAt: new Date(Date.now() - 3600000).toISOString() }) })],
    ['not yet valid', project(t, { edit: a => ({ ...a, approvedAt: new Date(Date.now() + 60000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() }) })],
    ['worker not the explorer model', project(t, { edit: a => ({ ...a, worker: 'pilot/m1' }) })],
    ['extra field', project(t, { edit: a => ({ ...a, extra: 1 }) })],
    ['wrong version', project(t, { edit: a => ({ ...a, version: 2 }) })],
  ];
  const garbage = project(t); fs.writeFileSync(path.join(garbage.dir, 'Artifacts', '.agent', 'bulk-read-approval.json'), '{not json');
  bad.push(['garbage', garbage]);
  for (const [name, p] of bad) await withIntercept(p, async call => {
    assert.equal(await call('read', { path: 'a.txt' }, p.dir), undefined, name);
    assert.equal(await call('bash', { command: 'cat a.txt' }, p.dir), undefined, name);
  });
  const p = project(t);
  for (const policyPath of [undefined, '', 'relative/policy.json', path.join(p.dir, 'missing.json')]) {
    await withGuard(p, async call => { assert.equal(await call('read', { path: 'a.txt' }, p.dir), undefined, String(policyPath)); }, { PI_ROLE_POLICY_PATH: policyPath });
  }
  fs.writeFileSync(p.policyPath, '{broken');
  await withGuard(p, async call => { assert.equal(await call('read', { path: 'a.txt' }, p.dir), undefined, 'corrupt policy'); });
  await withIntercept(p, async call => { assert.equal(await call('read', { path: 'a.txt' }, p.dir), undefined, 'library rejects corrupt policy'); });
  // Presence control: the retained library intercepts with the same good policy.
  fs.writeFileSync(p.policyPath, JSON.stringify(policy));
  await withIntercept(p, async call => { assert.ok(blocked(await call('read', { path: 'a.txt' }, p.dir))); });
});

test('/sync and /handoff posture: without an approval no read is touched; the guard has no workflow special case', async t => {
  const p = project(t, { approval: false });
  await withGuard(p, async call => {
    for (const file of ['a.txt', 'other.txt', 'Artifacts/.agent/current_task.md']) assert.equal(await call('read', { path: file }, p.dir), undefined, file);
  });
});

test('Parent and child roles read normally with an approval', async t => {
  const p = project(t);
  for (const role of ['explorer', 'coder', 'auditor']) {
    await withGuard(p, async call => { assert.equal(await call('read', { path: 'a.txt' }, p.dir), undefined, role); }, { PI_ROLE: role });
  }
  await withGuard(p, async call => { assert.equal(await call('read', { path: 'a.txt' }, p.dir), undefined); });
});

test('library intercepts a case alias of an approved file (Windows)', { skip: process.platform !== 'win32' }, async t => {
  const p = project(t);
  await withIntercept(p, async call => {
    assert.ok(blocked(await call('read', { path: 'A.TXT' }, p.dir)));
    assert.ok(blocked(await call('read', { path: 'DOCS/B.TXT' }, p.dir)));
    assert.ok(blocked(await call('bash', { command: 'cat A.TXT' }, p.dir)));
  });
});

test('a link to an approved file is intercepted; a link to an unapproved file is not', async t => {
  const p = project(t); let linked = true;
  try { fs.symlinkSync(path.join(p.dir, 'a.txt'), path.join(p.dir, 'ln.txt')); fs.symlinkSync(path.join(p.dir, 'other.txt'), path.join(p.dir, 'ln2.txt')); } catch { linked = false; }
  if (!linked) return t.skip('symlink creation not permitted here');
  await withIntercept(p, async call => {
    assert.ok(blocked(await call('read', { path: 'ln.txt' }, p.dir)));
    assert.equal(await call('read', { path: 'ln2.txt' }, p.dir), undefined);
  });
});

test('library redirects shell whole-file readers; bounded and compound forms pass (documented bypasses)', async t => {
  const p = project(t);
  await withIntercept(p, async call => {
    for (const command of ['cat a.txt', 'cat ./a.txt', 'cat "a.txt"', "cat 'docs/b.txt'", 'cat -n a.txt', 'cat -A -n a.txt', 'less a.txt', 'more a.txt', 'cat other.txt a.txt', `cat ${path.join(p.dir, 'a.txt').replaceAll('\\', '/')}`]) {
      const r = await call('bash', { command }, p.dir);
      assert.ok(blocked(r), command); assert.match(r.reason, /pi_bulk_read/);
    }
    assert.equal(await call('powershell', { command: 'cat a.txt' }, p.dir), undefined, 'powershell is not intercepted');
    // Presence controls: unapproved files and non-reader commands pass.
    for (const command of ['cat other.txt', 'echo a.txt', 'ls a.txt', 'git status']) assert.equal(await call('bash', { command }, p.dir), undefined, command);
    // Known bypasses, asserted so a change in behaviour is a deliberate, reviewed decision.
    for (const command of ['head -n 5 a.txt', 'tail a.txt', 'cat a.txt | head', 'cat a.txt && echo done', 'cat a.txt; true', 'cat < a.txt', 'cat $(echo a.txt)', 'cat a.*',
      'sed -n 1,999p a.txt', 'awk 1 a.txt', 'grep -n "" a.txt', 'python -c "print(open(\'a.txt\').read())"', 'node -e "1"', 'type a.txt', 'Get-Content a.txt']) {
      assert.equal(await call('bash', { command }, p.dir), undefined, `bypass: ${command}`);
    }
  });
});

test('Parent write and edit to the approval, ledger and lock files are blocked; other agent state stays writable', async t => {
  const p = project(t);
  await withGuard(p, async call => {
    for (const name of ['bulk-read-approval.json', 'bulk-read-ledger.jsonl', 'bulk-read-ledger.lock']) {
      for (const toolName of ['write', 'edit']) {
        for (const spelling of [`Artifacts/.agent/${name}`, `./Artifacts/.agent/${name}`, `@Artifacts/.agent/${name}`, path.join(p.dir, 'Artifacts', '.agent', name), `Artifacts/Temp/../.agent/${name}`]) {
          const r = await call(toolName, { path: spelling, content: 'x', edits: [] }, p.dir);
          assert.ok(blocked(r), `${toolName} ${spelling}`); assert.match(r.reason, /approval|ledger|bulk-read/i);
        }
      }
    }
    // Presence controls: other state files are not blocked by the new rule.
    for (const file of ['Artifacts/.agent/current_task.md', 'Artifacts/HANDOFF_BRIEF.md', 'docs/ok.md']) {
      assert.equal(await call('write', { path: file, content: 'x' }, p.dir), undefined, file);
    }
  });
  if (process.platform === 'win32') await withGuard(p, async call => {
    for (const spelling of ['Artifacts/.agent/BULK-READ-APPROVAL.JSON', 'artifacts/.AGENT/bulk-read-approval.json', 'Artifacts/.agent/bulk-read-approval.json.', 'Artifacts/.agent/bulk-read-approval.json ']) {
      assert.ok(blocked(await call('write', { path: spelling, content: 'x' }, p.dir)), spelling);
    }
  });
});

test('the write block applies with no approval present and does not depend on the policy', async t => {
  const p = project(t, { approval: false });
  await withGuard(p, async call => {
    assert.ok(blocked(await call('write', { path: 'Artifacts/.agent/bulk-read-approval.json', content: '{}' }, p.dir)));
  }, { PI_ROLE_POLICY_PATH: undefined });
});

test('the concierge branch is unchanged and never intercepts', async t => {
  const p = project(t);
  await withGuard(p, async call => {
    const r = await call('read', { path: 'a.txt' }, p.dir);
    assert.ok(r === undefined || !/pi_bulk_read/.test(r.reason ?? ''));
  }, { PI_ROLE: 'concierge', PI_CONCIERGE_ROOT: p.dir });
});

// ---- mutation-pass additions ----
test('library resolves file URLs; a directory is never intercepted even if listed as approved', async t => {
  const p = project(t, { edit: a => ({ ...a, approvedPaths: [...a.approvedPaths, 'docs'], approvedSha256: { ...a.approvedSha256, docs: hash('d') } }) });
  await withIntercept(p, async call => {
    assert.ok(blocked(await call('read', { path: pathToFileURL(path.join(p.dir, 'a.txt')).href }, p.dir)));
    assert.equal(await call('read', { path: 'docs' }, p.dir), undefined, 'directory');
    assert.equal(await call('read', { path: 'file:///definitely/not/there.txt' }, p.dir), undefined);
  });
});

test('the approval-state write block is scoped to Artifacts/.agent of this project', async t => {
  const p = project(t);
  await withGuard(p, async call => {
    for (const file of ['docs/bulk-read-approval.json', 'Artifacts/Temp/bulk-read-ledger.jsonl', 'bulk-read-ledger.lock', 'Artifacts/bulk-read-approval.json']) {
      assert.equal(await call('write', { path: file, content: 'x' }, p.dir), undefined, file);
    }
  });
});

test('a case alias is blocked even before Artifacts/.agent exists (Windows)', { skip: process.platform !== 'win32' }, async t => {
  const p = project(t); fs.rmSync(path.join(p.dir, 'Artifacts'), { recursive: true, force: true });
  await withGuard(p, async call => {
    assert.ok(blocked(await call('write', { path: 'ARTIFACTS/.AGENT/bulk-read-approval.json', content: 'x' }, p.dir)));
    assert.ok(blocked(await call('write', { path: 'Artifacts/.agent/bulk-read-approval.json', content: 'x' }, p.dir)));
  });
});

test('a project reached through a junction or link is protected the same way', async t => {
  const p = project(t); const link = path.join(os.tmpdir(), `pi-intercept-link-${process.pid}-${Date.now()}`);
  try { fs.symlinkSync(p.dir, link, 'junction'); } catch { return t.skip('link creation not permitted here'); }
  t.after(() => { try { fs.rmSync(link, { force: true, recursive: true }); } catch { /* removed */ } });
  await withGuard(p, async call => {
    assert.ok(blocked(await call('write', { path: 'Artifacts/.agent/bulk-read-approval.json', content: 'x' }, link)), 'write through a linked cwd');
    assert.equal(await call('read', { path: 'a.txt' }, link), undefined, 'guard read through a linked cwd');
  });
  await withIntercept(p, async call => {
    assert.ok(blocked(await call('read', { path: 'a.txt' }, link)), 'library read through a linked cwd');
  });
});

test('a relative PI_ROLE_POLICY_PATH does not cause guard interception', async t => {
  const p = project(t); const relative = path.relative(process.cwd(), p.policyPath);
  if (path.isAbsolute(relative)) return t.skip('policy is on another drive; no relative spelling exists');
  await withGuard(p, async call => { assert.equal(await call('read', { path: 'a.txt' }, p.dir), undefined); }, { PI_ROLE_POLICY_PATH: relative });
});

test('library sees shell metacharacters inside quotes as data; outside quotes they disable interception', async t => {
  const p = project(t);
  await withIntercept(p, async call => {
    assert.ok(blocked(await call('bash', { command: 'cat "a.txt" "o;ther"' }, p.dir)), 'quoted semicolon operand is data');
    assert.equal(await call('bash', { command: 'cat a.txt\ncat b' }, p.dir), undefined, 'newline');
    assert.equal(await call('bash', { command: 'cat a.txt\\' }, p.dir), undefined, 'backslash');
    assert.equal(await call('bash', { command: 'cat a.txt ${HOME}' }, p.dir), undefined, 'brace expansion');
    assert.equal(await call('bash', { command: 'cat a.txt [x]' }, p.dir), undefined, 'glob class');
  });
});

// ---- audit corrections (T9 MEDIUM-1..4) ----
const touch = (file, seconds) => { const when = new Date(Date.now() + seconds * 1000); fs.utimesSync(file, when, when); };

test('library stops redirecting an edited file; an unchanged one still is redirected', async t => {
  const p = project(t); const a = path.join(p.dir, 'a.txt');
  await withIntercept(p, async call => {
    assert.ok(blocked(await call('read', { path: 'a.txt' }, p.dir)));
    fs.writeFileSync(a, 'one\ntwo\nCHANGED\n'); touch(a, 5);
    assert.equal(await call('read', { path: 'a.txt' }, p.dir), undefined, 'edited file');
    assert.equal(await call('bash', { command: 'cat a.txt' }, p.dir), undefined, 'edited file via shell');
    assert.ok(blocked(await call('read', { path: 'docs/b.txt' }, p.dir)), 'sibling approved file is still redirected');
    fs.writeFileSync(a, 'one\ntwo\nthree\n'); touch(a, 10);
    assert.ok(blocked(await call('read', { path: 'a.txt' }, p.dir)), 'restored bytes are redirected again');
    fs.writeFileSync(a, 'XXXXXXXXXXXXXX'); touch(a, 10);
    assert.equal(await call('read', { path: 'a.txt' }, p.dir), undefined, 'changed bytes at an equal size');
  });
});

test('a size change with an unchanged mtime is still detected (cache keys on both)', async t => {
  const p = project(t); const a = path.join(p.dir, 'a.txt');
  fs.utimesSync(a, 1700000000, 1700000000); const mtimeMs = fs.statSync(a).mtimeMs;
  await withIntercept(p, async call => {
    assert.ok(blocked(await call('read', { path: 'a.txt' }, p.dir)));
    fs.writeFileSync(a, 'a different length of content'+String.fromCharCode(10)); fs.utimesSync(a, 1700000000, 1700000000);
    assert.equal(fs.statSync(a).mtimeMs, mtimeMs, 'mtime restored (control)');
    assert.equal(await call('read', { path: 'a.txt' }, p.dir), undefined);
  });
});

test('a protected name with an NTFS stream suffix is blocked even when the file does not exist yet (Windows)', { skip: process.platform !== 'win32' }, async t => {
  const p = project(t);
  await withGuard(p, async call => {
    assert.ok(blocked(await call('write', { path: 'Artifacts/.agent/bulk-read-ledger.lock::$DATA', content: 'x' }, p.dir)));
    assert.equal(fs.existsSync(path.join(p.dir, 'Artifacts', '.agent', 'bulk-read-ledger.lock')), false, 'control: the file does not exist');
  });
});

test('an 8.3 short name of the approval file is blocked (Windows, when short names exist)', { skip: process.platform !== 'win32' }, async t => {
  const p = project(t); const file = path.join(p.dir, 'Artifacts', '.agent', 'bulk-read-approval.json');
  const { spawnSync } = await import('node:child_process');
  const short = spawnSync('cmd.exe', ['/d', '/c', `for %I in ("${file}") do @echo %~sI`], { encoding: 'utf8' }).stdout.trim();
  if (!short || short.toLowerCase() === file.toLowerCase() || !fs.existsSync(short)) return t.skip('8.3 short names are not available here');
  await withGuard(p, async call => { assert.ok(blocked(await call('write', { path: short, content: 'x' }, p.dir)), short); });
});

test('a policy with no rate for the approved worker disables interception (the tool would refuse rate-missing)', async t => {
  for (const jobBudget of [undefined, { perJobUsd: 1, perSessionUsd: 5, rates: {} }, { perJobUsd: 1, perSessionUsd: 5, rates: { 'pilot/m1': { inputPerMTok: 1, outputPerMTok: 2 } } }]) {
    const p = project(t); const next = { ...policy }; if (jobBudget) next.jobBudget = jobBudget; else delete next.jobBudget;
    fs.writeFileSync(p.policyPath, JSON.stringify(next));
    await withIntercept(p, async call => { assert.equal(await call('read', { path: 'a.txt' }, p.dir), undefined, JSON.stringify(jobBudget)); });
  }
});

test('Windows shell path spellings and Unicode spaces cannot dodge the write block; library redirects reads', { skip: process.platform !== 'win32' }, async t => {
  const p = project(t); const rest = p.dir.slice(2).replaceAll('\\', '/'); const drive = p.dir[0].toLowerCase();
  await withGuard(p, async call => {
    for (const prefix of [`/${drive}`, `/mnt/${drive}`, `/cygdrive/${drive}`]) {
      assert.ok(blocked(await call('write', { path: `${prefix}${rest}/Artifacts/.agent/bulk-read-approval.json`, content: 'x' }, p.dir)), `write ${prefix}`);
      assert.ok(blocked(await call('edit', { path: `${prefix}${rest}/Artifacts/.agent/bulk-read-ledger.jsonl`, edits: [] }, p.dir)), `edit ${prefix}`);
      assert.equal(await call('read', { path: `${prefix}${rest}/a.txt` }, p.dir), undefined, `guard read ${prefix}`);
    }
    for (const tail of ['\u00a0', '\u2003', ' \u00a0.', '::$DATA']) {
      assert.ok(blocked(await call('write', { path: `Artifacts/.agent/bulk-read-approval.json${tail}`, content: 'x' }, p.dir)), JSON.stringify(tail));
    }
    assert.equal(await call('write', { path: 'Artifacts/.agent/bulk-read-approval.json.bak', content: 'x' }, p.dir), undefined, 'a different file name is not protected');
  });
  await withIntercept(p, async call => {
    for (const prefix of [`/${drive}`, `/mnt/${drive}`, `/cygdrive/${drive}`]) {
      assert.ok(blocked(await call('read', { path: `${prefix}${rest}/a.txt` }, p.dir)), `library read ${prefix}`);
    }
  });
});

test('documented bypasses: hard links, shell forgery of state files, and an oversized limit', async t => {
  const p = project(t); let hard = true;
  try { fs.linkSync(path.join(p.dir, 'a.txt'), path.join(p.dir, 'hard.txt')); } catch { hard = false; }
  await withGuard(p, async call => {
    if (hard) assert.equal(await call('read', { path: 'hard.txt' }, p.dir), undefined, 'a hard link is a different path (not detected)');
    for (const command of ['cp other.txt Artifacts/.agent/bulk-read-approval.json', 'cp other.txt Artifacts/.agent/bulk-read-ledger.jsonl',
      'node -e "require(\'fs\').writeFileSync(\'Artifacts/.agent/bulk-read-approval.json\',\'{}\')"']) {
      assert.equal(await call('bash', { command }, p.dir), undefined, `shell forgery is not blocked: ${command}`);
    }
    assert.equal(await call('read', { path: 'a.txt', limit: 1e9 }, p.dir), undefined, 'any positive integer limit passes');
  });
  await withIntercept(p, async call => {
    if (hard) assert.equal(await call('read', { path: 'hard.txt' }, p.dir), undefined, 'library does not detect a hard link');
    assert.equal(await call('read', { path: 'a.txt', limit: 1e9 }, p.dir), undefined, 'library accepts any positive integer limit');
    assert.ok(blocked(await call('read', { path: 'a.txt' }, p.dir)), 'library presence control');
  });
});

test('UNC and device paths are never resolved by the new rules (they are left to the existing guard)', { skip: process.platform !== 'win32' }, async t => {
  const p = project(t);
  await withGuard(p, async call => {
    assert.equal(await call('read', { path: '\\\\no-such-host-pi\\share\\a.txt' }, p.dir), undefined);
    const r = await call('write', { path: '\\\\no-such-host-pi\\share\\Artifacts\\.agent\\bulk-read-approval.json', content: 'x' }, p.dir);
    assert.ok(blocked(r)); assert.match(r.reason, /Network or device path/);
  });
});

test('with an approval present, /sync and /handoff state files stay readable and writable', async t => {
  const p = project(t);
  await withGuard(p, async call => {
    for (const file of ['Artifacts/.agent/current_task.md', 'Artifacts/HANDOFF_BRIEF.md', 'Artifacts/TODO.md']) {
      fs.writeFileSync(path.join(p.dir, file), 'state');
      assert.equal(await call('read', { path: file }, p.dir), undefined, `read ${file}`);
      assert.equal(await call('bash', { command: `cat ${file}` }, p.dir), undefined, `cat ${file}`);
      assert.equal(await call('write', { path: file, content: 'x' }, p.dir), undefined, `write ${file}`);
      assert.equal(await call('edit', { path: file, edits: [] }, p.dir), undefined, `edit ${file}`);
    }
    assert.equal(await call('read', { path: 'a.txt' }, p.dir), undefined, 'guard does not redirect approved file');
  });
  await withIntercept(p, async call => {
    assert.ok(blocked(await call('read', { path: 'a.txt' }, p.dir)), 'presence control: approval is live');
  });
});
