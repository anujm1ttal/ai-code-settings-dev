import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';

const file = new URL('../pi/lib/job-budget.mjs', import.meta.url);
async function makeBudget(options = {}) {
  assert.ok(existsSync(file), 'job budget module must exist');
  const { createJobBudget } = await import(file.href);
  return createJobBudget({ perJobUsd: 1, perSessionUsd: 3,
    rates: { model: { inputPerMTok: 2, outputPerMTok: 4 } }, modelOf: () => 'model', ...options });
}

test('three reservations fit exactly, fourth is denied, missing model fails closed', async () => {
  const budget = await makeBudget();
  for (let i = 0; i < 3; i++) budget.reserve('strategist');
  assert.deepEqual(budget.snapshot(), { spentUsd: 0, reservedUsd: 3, remainingUsd: 0, perJobUsd: 1, perSessionUsd: 3 });
  assert.throws(() => budget.reserve('auditor'), /session job budget exhausted/);
  const missing = await makeBudget({ modelOf: () => 'missing' });
  assert.throws(() => missing.reserve('auditor'), /no job rate configured for missing/);
});

test('settlement replaces reservation, frees headroom, and defaults cache to input', async () => {
  const budget = await makeBudget();
  const reservation = budget.reserve('strategist');
  assert.deepEqual(budget.settle(reservation, { input: 100000, output: 50000, cacheRead: 10000, cacheWrite: 5000 }),
    { usd: 0.43, overBudget: false });
  assert.equal(budget.snapshot().remainingUsd, 2.57);
  budget.reserve('auditor'); budget.reserve('auditor');
  assert.throws(() => budget.reserve('auditor'), /exhausted/);
});

test('invalid usage stays reserved and settle is idempotent even after unknown usage', async () => {
  for (const usage of [null, {}, { input: -1, output: 0 }, { input: 0, output: NaN },
    { input: 0, output: 0, cacheRead: -1 }, { input: 0, output: 0, cacheWrite: Infinity }]) {
    const budget = await makeBudget(); const r = budget.reserve('auditor');
    budget.settle(r, usage);
    budget.settle(r, { input: 0, output: 0 });
    assert.equal(budget.snapshot().reservedUsd, 1);
    assert.equal(budget.snapshot().spentUsd, 0);
  }
});

test('all-zero usage cannot settle a reservation: a real child call always uses tokens, so zeros mean unknown', async () => {
  const budget = await makeBudget();
  const reservation = budget.reserve('strategist');
  assert.equal(budget.settle(reservation, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }), undefined);
  assert.deepEqual(budget.snapshot(), { spentUsd: 0, reservedUsd: 1, remainingUsd: 2, perJobUsd: 1, perSessionUsd: 3 });
  const control = budget.reserve('auditor');
  assert.deepEqual(budget.settle(control, { input: 1, output: 0 }), { usd: 0.000002, overBudget: false });
});

test('over-budget cost is charged fully, flagged, and settled only once', async () => {
  const budget = await makeBudget(); const r = budget.reserve('auditor');
  assert.deepEqual(budget.settle(r, { input: 1000000, output: 0 }), { usd: 2, overBudget: true });
  budget.settle(r, { input: 0, output: 0 });
  assert.deepEqual(budget.snapshot(), { spentUsd: 2, reservedUsd: 0, remainingUsd: 1, perJobUsd: 1, perSessionUsd: 3 });
  budget.reserve('strategist');
  assert.throws(() => budget.reserve('auditor'), /exhausted/);
});

test('decimal reservations and repeated small charges avoid floating drift', async () => {
  const budget = await makeBudget({ perJobUsd: 0.1, perSessionUsd: 0.3 });
  const reservations = Array.from({ length: 3 }, () => budget.reserve('strategist'));
  assert.throws(() => budget.reserve('strategist'), /exhausted/);
  for (const r of reservations) budget.settle(r, { input: 50000, output: 0 });
  assert.equal(budget.snapshot().spentUsd, 0.3);
  assert.equal(budget.snapshot().remainingUsd, 0);
});

test('explicit cache rates are used', async () => {
  const budget = await makeBudget({ rates: { model: { inputPerMTok: 2, outputPerMTok: 4, cacheReadPerMTok: 0, cacheWritePerMTok: 1 } } });
  assert.deepEqual(budget.settle(budget.reserve('auditor'), { input: 0, output: 0, cacheRead: 100000, cacheWrite: 100000 }),
    { usd: 0.1, overBudget: false });
});
