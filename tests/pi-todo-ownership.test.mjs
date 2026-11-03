import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalTaskHash } from '../pi/lib/verdict.mjs';
import { createHash } from 'node:crypto';

const mod = await import('../pi/lib/todo-ownership.mjs').catch(() => null);
const api = () => { assert.ok(mod, 'shared TODO validator must exist'); return mod; };
const b = s => Buffer.from(s, 'utf8');
const opts = { approvalLinePrefixes: ['**APPROVED'] };
const task = (id = 'T1', marker = ' ', suffix = '') => `- [${marker}] [coder] ${id}: Title — Success: criteria — Mode: AFK${suffix}`;
const verified = ' — Auditor-verified 2026-01-02 (ref)';
const reviewed = ' — Auditor-reviewed 2026-01-02 (ref)';
const args = { taskId: 'T1', verdict: 'PASS', date: '2026-01-02', ref: 'ref' };

test('shared parser accepts task grammar and compatible hash', () => {
  const { parseTodo } = api();
  const line = `${task()} — Blocked by: T2, T3${reviewed}`;
  const r = parseTodo(b(`# Heading\n\n${line}\n`), opts);
  assert.equal(r.eligible, true, r.errors.join('; '));
  assert.deepEqual(r.tasks[0].blockedBy, ['T2', 'T3']);
  assert.equal(r.tasks[0].suffix, reviewed);
  assert.equal(canonicalTaskHash(line), canonicalTaskHash(line.replace('[ ]', '[x]').replace(reviewed, verified)));
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.tasks) && Object.isFrozen(r.tasks[0]));
});

test('ineligible input cases have a passing presence control', async t => {
  const { parseTodo } = api();
  const cases = [
    ['duplicate', `${task()}\n${task()}\n`, `${task()}\n${task('T2')}\n`],
    ['fenced', `\`\`\`\n${task()}\n\`\`\`\n`, `\`\`\`\nprose\n\`\`\`\n${task()}\n`],
    ['indented', `  ${task()}\n`, `${task()}\n`],
    ['malformed', '- [ ] [coder] T1: no success\n', `${task()}\n`],
    ['sub-block', `${task()}\n  extra\n`, `${task()}\n\n  extra\n`],
    ['continuation', `${task()}\ncontinuation\n`, `${task()}\n\ncontinuation\n`],
    ['bad approval in task', task('T1').replace('criteria', '**APPROVED x'), `**APPROVED x\n\n${task()}\n`],
    ['bad approval in fence', '```\n**APPROVED x\n```\n', `**APPROVED x\n\n${task()}\n`],
    ['ambiguous approval in prose', 'words **APPROVED x\n', `**APPROVED x\n\n${task()}\n`],
    ['unclosed fence', '```\nhello\n', '```\nhello\n```\n'],
    ['malformed suffix', `${task()} — Auditor-verified 2026-01-02 (a)b)\n`, `${task()}${verified}\n`],
    ['nested approval', '**APPROVED one\n**APPROVED two\n', '**APPROVED one\n\n**APPROVED two\n'],
    ['task inside approval', `**APPROVED one\n${task()}\n`, `**APPROVED one\n\n${task()}\n`],
    ['lone CR', `${task()}\r`, `${task()}\r\n`],
    ['bad mode', task().replace('AFK', 'MAYBE'), task()],
    ['bad role', task().replace('[coder]', '[unknown]'), task()],
    ['bad blocker', `${task()} — Blocked by: T2, ??`, `${task()} — Blocked by: T2, T3`],
  ];
  for (const [name, bad, good] of cases) await t.test(name, () => {
    assert.equal(parseTodo(b(good), opts).eligible, true, name);
    assert.equal(parseTodo(b(bad), opts).eligible, false, name);
  });
  assert.equal(parseTodo(b(task()), opts).eligible, true);
  assert.equal(parseTodo(Buffer.from([0xff]), opts).eligible, false);
  assert.equal(parseTodo(b(task()), { approvalLinePrefixes: [null] }).eligible, false);
  assert.equal(parseTodo(b(task()), { approvalLinePrefixes: ['A', 'AA'] }).eligible, false);
  assert.equal(parseTodo(null, opts).eligible, false);
});

test('all roles and markers parse, including blocked and review records', () => {
  const { parseTodo } = api();
  const roles = ['strategist', 'coder', 'auditor', 'scribe', 'user', 'explorer'];
  const source = roles.map((role, i) => `- [${[' ', 'x', '-'][i % 3]}] [${role}] ID${i}: Title — Success: criteria — Mode: ${i % 2 ? 'HITL' : 'AFK'}${i === 0 ? ' — Blocked by: ID1, ID2' : ''}${i === 1 ? verified : ''}${i === 2 ? reviewed : ''}`).join('\n');
  const parsed = parseTodo(b(source), opts);
  assert.equal(parsed.eligible, true, parsed.errors.join('; '));
  assert.deepEqual(parsed.tasks.map(x => x.role), roles);
  assert.deepEqual(parsed.tasks[0].blockedBy, ['ID1', 'ID2']);
  assert.equal(parsed.tasks[1].suffix, verified);
  assert.equal(parsed.tasks[2].suffix, reviewed);
});

test('approval hashes include BOM and all block line endings', () => {
  const { parseTodo } = api();
  const block = '\uFEFF**APPROVED yes\r\nmore\n';
  const parsed = parseTodo(b(`${block}\n${task()}\n`), opts);
  assert.equal(parsed.eligible, true);
  assert.equal(parsed.approvals[0].bytesSha256, createHash('sha256').update(b(block)).digest('hex'));
  assert.equal(parsed.bom, true);
  assert.equal(parsed.finalNewline, true);
  assert.deepEqual(parsed.lines.slice(0, 2).map(x => x.eol), ['\r\n', '\n']);
});

test('strategist preserves task authority and approvals', async t => {
  const { validateStrategistChange: v } = api();
  const old = `**APPROVED yes\nkept\n\n${task()}\n${task('T2', 'x', verified)}\n`;
  const cases = [
    ['delete task', old.replace(`${task()}\n`, '')],
    ['marker', old.replace(task(), task('T1', 'x'))],
    ['suffix', old.replace(task(), task('T1', ' ', reviewed))],
    ['verified definition', old.replace(task('T2', 'x', verified), task('T2', 'x', verified).replace('criteria', 'other'))],
    ['approval edit', old.replace('kept', 'changed')],
    ['approval delete', old.replace('**APPROVED yes\nkept\n\n', '')],
    ['new checked', old + `${task('T3', 'x')}\n`],
    ['new suffix', old + `${task('T3', ' ', reviewed)}\n`],
    ['unchanged line eol', old.replace('kept\n', 'kept\r\n')],
    ['bom', '\uFEFF' + old],
    ['final newline', old.slice(0, -1)],
  ];
  const good = old + `${task('T3')}\n`;
  for (const [name, bad] of cases) await t.test(name, () => {
    assert.equal(v(b(old), b(good), opts).allow, true);
    assert.equal(v(b(old), b(bad), opts).allow, false, name);
  });
  assert.equal(v(b(old), b(old.replace(task(), task().replace('criteria', 'new criteria'))), opts).allow, true);
  assert.equal(v(b(task()), b(task().replace('criteria', 'updated')), opts).allow, true);
  assert.equal(v(b(task()), b(task().replace('criteria', 'updated') + '\n'), opts).allow, false);
  assert.equal(v(b(old), b(old.replace(`${task()}\n${task('T2', 'x', verified)}`, `${task('T2', 'x', verified)}\n${task()}`)), opts).allow, true);
});

test('auditor constructs exact bytes and validates no collateral change', async t => {
  const { buildAuditorRecording: build, validateAuditorRecording: validate } = api();
  for (const [name, eols, bom, final] of [
    ['LF', ['\n', '\n'], '', '\n'], ['CRLF', ['\r\n', '\r\n'], '', '\r\n'],
    ['mixed BOM no final', ['\r\n', '\n'], '\uFEFF', ''],
  ]) await t.test(name, () => {
    const original = b(`${bom}# heading${eols[0]}${task()}${eols[1]}${task('T2')}${final}`);
    const expected = b(`${bom}# heading${eols[0]}${task('T1', 'x', verified)}${eols[1]}${task('T2')}${final}`);
    const result = build(original, args);
    assert.equal(result.ok, true, result.reasons.join('; '));
    assert.deepEqual(result.candidate, expected);
    assert.equal(validate(original, expected, args).allow, true);
    assert.equal(validate(original, b(expected.toString().replace('T2:', 'T3:')), args).allow, false);
    assert.equal(validate(original, expected, { ...args, taskId: 'T2' }).allow, false);
    const reopened = build(expected, { ...args, verdict: 'FAIL' });
    assert.equal(reopened.ok, true);
    assert.deepEqual(reopened.candidate, b(`${bom}# heading${eols[0]}${task('T1', ' ', reviewed)}${eols[1]}${task('T2')}${final}`));
    assert.equal(validate(expected, reopened.candidate, { ...args, verdict: 'FAIL' }).allow, true);
    const again = build(reopened.candidate, args);
    assert.deepEqual(again.candidate, expected);
  });
});

test('auditor refusal cases have a permitted presence control', async t => {
  const { buildAuditorRecording: build } = api();
  const original = b(`${task()}\n${task('T2')}\n`);
  const cases = [
    ['unknown task', original, { ...args, taskId: 'T9' }],
    ['duplicate task', b(`${task()}\n${task()}\n`), args],
    ['incomplete', original, { ...args, verdict: 'INCOMPLETE' }],
    ['bad verdict', original, { ...args, verdict: 'pass' }],
    ['already checked', b(task('T1', 'x', verified)), args],
    ['bad date', original, { ...args, date: '2026-99-99' }],
    ['empty ref', original, { ...args, ref: '' }],
    ['ambiguous ref', original, { ...args, ref: 'a)b' }],
    ['newline ref', original, { ...args, ref: 'a\nb' }],
    ['bad UTF8', Buffer.from([0xff]), args],
    ['bad options', original, { ...args, approvalLinePrefixes: [null] }],
    ['bad approval section', b(`**APPROVED yes\n${task()}\n`), { ...args, approvalLinePrefixes: ['**APPROVED'] }],
  ];
  for (const [name, input, arg] of cases) await t.test(name, () => {
    assert.equal(build(original, args).ok, true);
    const r = build(input, arg);
    assert.equal(r.ok, false, name);
    assert.equal(r.candidate, null);
    assert.ok(r.reasons.length);
  });
  const blocked = b(task('T1', '-'));
  assert.deepEqual(build(blocked, args).candidate, b(task('T1', 'x', verified)));
  assert.deepEqual(build(blocked, { ...args, verdict: 'FAIL' }).candidate, b(task('T1', ' ', reviewed)));
  const protectedFile = b(`\uFEFF**APPROVED yes\r\nmore\n\n${task('T1', ' ', reviewed)}`);
  const protectedArgs = { ...args, approvalLinePrefixes: opts.approvalLinePrefixes };
  assert.deepEqual(build(protectedFile, protectedArgs).candidate, b(`\uFEFF**APPROVED yes\r\nmore\n\n${task('T1', 'x', verified)}`));
});
