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
    { usd: 0.43, overBudget: false, estimated: true, rateStatus: 'unlabelled' });
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
  assert.deepEqual(budget.settle(control, { input: 1, output: 0 }), { usd: 0.000002, overBudget: false, estimated: true, rateStatus: 'unlabelled' });
});

test('over-budget cost is charged fully, flagged, and settled only once', async () => {
  const budget = await makeBudget(); const r = budget.reserve('auditor');
  assert.deepEqual(budget.settle(r, { input: 1000000, output: 0 }), { usd: 2, overBudget: true, estimated: true, rateStatus: 'unlabelled' });
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
    { usd: 0.1, overBudget: false, estimated: true, rateStatus: 'unlabelled' });
});

const tieredRate = { status: 'verified', cacheWriteRetention: '5m', tiers: [
  { upToPromptTokens: 100000, inputPerMTok: 0.1, outputPerMTok: 0.5, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.125 },
  { inputPerMTok: 0.5, outputPerMTok: 2.5, cacheReadPerMTok: 0.05, cacheWritePerMTok: 0.625 }] };
const call = (input, output = 0) => ({ stopReason: 'stop', completeness: 'known', usage: { input, output, cacheRead: 0, cacheWrite: 0 } });

test('per-request usage prices each call in its own tier and is not labelled an estimate', async () => {
  const budget = await makeBudget({ rates: { model: tieredRate } });
  const r = budget.reserve('auditor');
  const calls = [call(60000), call(60000), call(150000)];
  const total = { input: 270000, output: 0, cacheRead: 0, cacheWrite: 0 };
  const result = budget.settle(r, total, calls);
  assert.equal(result.estimated, false); assert.equal(result.rateStatus, 'verified');
  assert.equal(result.usd, Math.round((2 * 60000 * 0.1 + 150000 * 0.5) / 1e6 * 1e12) / 1e12);
});

test('without per-request calls the highest tier applies and the cost is labelled an estimate', async () => {
  const budget = await makeBudget({ rates: { model: tieredRate } });
  const result = budget.settle(budget.reserve('auditor'), { input: 120000, output: 0, cacheRead: 0, cacheWrite: 0 });
  assert.equal(result.estimated, true); assert.equal(result.usd, 0.06);
});

test('per-request calls that do not add up to the aggregate usage are not trusted', async () => {
  const budget = await makeBudget({ rates: { model: tieredRate } });
  const result = budget.settle(budget.reserve('auditor'), { input: 120000, output: 0, cacheRead: 0, cacheWrite: 0 }, [call(1000)]);
  assert.equal(result.estimated, true); assert.equal(result.usd, 0.06);
  const unknown = budget.settle(budget.reserve('auditor'), { input: 120000, output: 0, cacheRead: 0, cacheWrite: 0 },
    [{ ...call(120000), completeness: 'unknown' }]);
  assert.equal(unknown.estimated, true);
});

test('a malformed rate is refused at reservation', async () => {
  const budget = await makeBudget({ rates: { model: { tiers: [] } } });
  assert.throws(() => budget.reserve('auditor'), /invalid job rate/);
});

test('a rate that slips through with a non-finite price never corrupts the session budget', async () => {
  const bad = { ...tieredRate, cacheWriteByRetention: { '1h': 'abc' } }; // rate-level map on a tiered rate
  const budget = await makeBudget({ rates: { model: bad } });
  assert.throws(() => budget.reserve('auditor'), /invalid job rate/); // validation refuses it up front
  const good = await makeBudget({ rates: { model: tieredRate } });
  const r = good.reserve('auditor');
  const settled = good.settle(r, { input: 10, output: 0, cacheRead: 0, cacheWrite: 5, cacheWrite1h: Number.NaN });
  assert.equal(settled, undefined); // non-finite usage stays reserved, spent stays finite
  assert.equal(Number.isFinite(good.snapshot().spentUsd), true);
});

test('malformed or mismatched per-request calls fall back to the labelled aggregate estimate instead of stranding the reservation', async () => {
  const budget = await makeBudget({ rates: { model: tieredRate } });
  const total = { input: 120000, output: 0, cacheRead: 0, cacheWrite: 0 };
  const offsetting = [call(130000), { stopReason: 'stop', completeness: 'known', usage: { input: -10000, output: 0, cacheRead: 0, cacheWrite: 0 } }];
  const a = budget.settle(budget.reserve('auditor'), total, offsetting);
  assert.equal(a.estimated, true); assert.equal(a.usd, 0.06);
  const missing = [{ stopReason: 'stop', completeness: 'known', usage: { output: 0 } }];
  const b = budget.settle(budget.reserve('auditor'), { input: 0, output: 5, cacheRead: 0, cacheWrite: 0 }, missing);
  assert.equal(b.estimated, true);
});

test('an overflowing price (valid rate, absurd usage) cannot make spend infinite or NaN: it stays reserved', async () => {
  const budget = await makeBudget({ rates: { model: { inputPerMTok: 1e300, outputPerMTok: 1 } } });
  const r = budget.reserve('auditor');
  assert.equal(budget.settle(r, { input: 1e300, output: 0 }), undefined);
  assert.equal(Number.isFinite(budget.snapshot().spentUsd), true);
  assert.equal(budget.snapshot().reservedUsd, 1);
});

