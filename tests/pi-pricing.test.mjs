import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';

const file = new URL('../pi/lib/pricing.mjs', import.meta.url);
async function pricing() {
  assert.ok(existsSync(file), 'pricing module must exist');
  return import(file.href);
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

// Synthetic fixtures shaped like the supplied tables. They are test data, not configured live rates.
const tiered = {
  status: 'verified', source: 'fixture', cacheWriteRetention: '5m',
  tiers: [
    { upToPromptTokens: 100000, inputPerMTok: 0.1, outputPerMTok: 0.5, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.125,
      cacheWriteByRetention: { '1h': 0.2 } },
    { inputPerMTok: 0.5, outputPerMTok: 2.5, cacheReadPerMTok: 0.05, cacheWritePerMTok: 0.625,
      cacheWriteByRetention: { '1h': 1 } },
  ],
};
const flatSonnet = { status: 'verified', source: 'fixture', cacheWriteRetention: '5m',
  inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.1, cacheWritePerMTok: 2.5, cacheWriteByRetention: { '1h': 4 } };
const provisionalFlat = { status: 'provisional', source: 'fixture', inputPerMTok: 1, outputPerMTok: 5, cacheReadPerMTok: 0.05, cacheWritePerMTok: 1.25 };
const legacy = { inputPerMTok: 2, outputPerMTok: 4 };

test('tier is chosen from input + cacheRead + cacheWrite, boundary inclusive at the configured limit', async () => {
  const { priceRequest } = await pricing();
  const at = priceRequest({ input: 50000, output: 0, cacheRead: 30000, cacheWrite: 20000 }, tiered);
  assert.equal(at.tier, 0); assert.equal(at.promptTokens, 100000);
  const over = priceRequest({ input: 50000, output: 0, cacheRead: 30000, cacheWrite: 20001 }, tiered);
  assert.equal(over.tier, 1); assert.equal(over.promptTokens, 100001);
  close(at.usd, (50000 * 0.1 + 30000 * 0.01 + 20000 * 0.125) / 1e6);
  close(over.usd, (50000 * 0.5 + 30000 * 0.05 + 20001 * 0.625) / 1e6);
});

test('the selected tier prices every token class in that request, output included', async () => {
  const { priceRequest } = await pricing();
  const r = priceRequest({ input: 200000, output: 1000, cacheRead: 0, cacheWrite: 0 }, tiered);
  assert.equal(r.tier, 1);
  close(r.usd, (200000 * 0.5 + 1000 * 2.5) / 1e6);
});

test('tiers are decided per request, never from cumulative totals', async () => {
  const { priceRequests } = await pricing();
  const call = { input: 60000, output: 100, cacheRead: 0, cacheWrite: 0 };
  const two = priceRequests([call, call], tiered);
  close(two.usd, 2 * (60000 * 0.1 + 100 * 0.5) / 1e6); // both in the cheap tier although 120k combined
  assert.equal(two.estimated, false);
  assert.deepEqual(two.requests.map((r) => r.tier), [0, 0]);
});

test('session cost is the sum of individual request costs', async () => {
  const { priceRequest, priceRequests } = await pricing();
  const a = { input: 90000, output: 10, cacheRead: 0, cacheWrite: 0 };
  const b = { input: 150000, output: 20, cacheRead: 0, cacheWrite: 0 };
  close(priceRequests([a, b], tiered).usd, priceRequest(a, tiered).usd + priceRequest(b, tiered).usd);
});

test('flat pricing: Sonnet is not tiered and a legacy rate prices exactly as before', async () => {
  const { priceRequest } = await pricing();
  const big = priceRequest({ input: 900000, output: 0, cacheRead: 0, cacheWrite: 0 }, flatSonnet);
  assert.equal(big.tier, 0); close(big.usd, 1.8);
  const l = priceRequest({ input: 100000, output: 50000, cacheRead: 10000, cacheWrite: 5000 }, legacy);
  close(l.usd, 0.43); // cache defaults to the input price, as job-budget always did
});

test('cache writes default to the 5-minute price; 1-hour only when observed or configured', async () => {
  const { priceRequest } = await pricing();
  const u = { input: 0, output: 0, cacheRead: 0, cacheWrite: 1e6 };
  close(priceRequest(u, flatSonnet).usd, 2.5);
  assert.equal(priceRequest(u, flatSonnet).estimated, false);
  close(priceRequest(u, flatSonnet, { cacheRetention: '1h' }).usd, 4);
  const split = priceRequest({ ...u, cacheWrite1h: 4e5 }, flatSonnet); // 1h tokens are a subset of cacheWrite
  close(split.usd, 4e5 * 4 / 1e6 + 6e5 * 2.5 / 1e6);
  assert.equal(split.estimated, false);
});

test('missing 1-hour price or unspecified retention is labelled an estimate, never silently exact', async () => {
  const { priceRequest } = await pricing();
  const u = { input: 0, output: 0, cacheRead: 0, cacheWrite: 1e6 };
  const noRetention = priceRequest(u, provisionalFlat);
  close(noRetention.usd, 1.25); assert.equal(noRetention.estimated, true);
  assert.match(noRetention.reasons.join(' '), /retention/);
  const noOneHourPrice = priceRequest({ ...u, cacheWrite1h: 1e6 }, { ...provisionalFlat, cacheWriteRetention: '5m' });
  assert.equal(noOneHourPrice.estimated, true);
  assert.match(noOneHourPrice.reasons.join(' '), /1h/);
  const none = priceRequest({ input: 10, output: 10, cacheRead: 0, cacheWrite: 0 }, provisionalFlat);
  assert.equal(none.estimated, false); // no cache write, nothing unspecified
});

test('a Terra-style provisional rate gets no assumed threshold, retention or output surcharge', async () => {
  const { priceRequest } = await pricing();
  const r = priceRequest({ input: 500000, output: 1e6, cacheRead: 0, cacheWrite: 0 }, provisionalFlat);
  assert.equal(r.tier, 0); close(r.usd, 0.5 + 5);
  assert.equal(r.rateStatus, 'provisional');
});

test('aggregate-only usage uses the highest tier and is labelled an estimate', async () => {
  const { priceAggregate } = await pricing();
  const r = priceAggregate({ input: 60000, output: 0, cacheRead: 0, cacheWrite: 0 }, tiered);
  assert.equal(r.estimated, true); assert.equal(r.tier, 1);
  close(r.usd, 60000 * 0.5 / 1e6);
  assert.match(r.reasons.join(' '), /per-request/);
  const flat = priceAggregate({ input: 1000000, output: 0 }, flatSonnet);
  assert.equal(flat.estimated, true); close(flat.usd, 2);
});

test('invalid or missing token fields fail closed with ok:false', async () => {
  const { priceRequest, priceRequests } = await pricing();
  for (const bad of [null, {}, { input: -1, output: 0 }, { input: 1, output: Number.NaN }, { input: 1, output: 0, cacheRead: '5' }]) {
    assert.equal(priceRequest(bad, tiered).ok, false);
  }
  assert.equal(priceRequests([{ input: 1, output: 1 }, { input: -1, output: 0 }], tiered).ok, false);
  assert.equal(priceRequests([], tiered).ok, false);
});

test('verified, provisional and unlabelled dollars are kept in separate buckets', async () => {
  const { priceRequest, summarizeCosts } = await pricing();
  const u = { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 };
  const s = summarizeCosts([priceRequest(u, flatSonnet), priceRequest(u, provisionalFlat), priceRequest(u, legacy)]);
  close(s.verifiedUsd, 2); close(s.provisionalUsd, 1); close(s.unlabelledUsd, 2);
  close(s.totalUsd, 5); assert.equal(s.estimated, false);
  assert.equal(summarizeCosts([priceRequest({ ...u, cacheWrite: 1 }, provisionalFlat)]).estimated, true);
});

test('rate validation rejects malformed tiers and unknown status, accepts flat legacy', async () => {
  const { validateRate } = await pricing();
  assert.equal(validateRate(legacy), true);
  assert.equal(validateRate(tiered), true);
  assert.equal(validateRate({ ...tiered, status: 'guess' }), false);
  assert.equal(validateRate({ tiers: [] }), false);
  assert.equal(validateRate({ tiers: [{ inputPerMTok: 1, outputPerMTok: 1 }, { upToPromptTokens: 5, inputPerMTok: 1, outputPerMTok: 1 }] }), false); // unbounded tier must be last
  assert.equal(validateRate({ tiers: [{ upToPromptTokens: 5, inputPerMTok: 1, outputPerMTok: 1 }, { upToPromptTokens: 5, inputPerMTok: 1, outputPerMTok: 1 }, { inputPerMTok: 1, outputPerMTok: 1 }] }), false); // not strictly increasing
  assert.equal(validateRate({ inputPerMTok: 1 }), false);
  assert.equal(validateRate({ ...tiered, cacheWriteRetention: '7d' }), false);
});

test('cost label never presents an estimate or provisional rate as actual billing', async () => {
  const { costLabel } = await pricing();
  assert.equal(costLabel({ estimated: false, rateStatus: 'verified' }), ' (rate-based, verified rates)');
  assert.equal(costLabel({ estimated: true, rateStatus: 'verified' }), ' (estimate, verified rates)');
  assert.equal(costLabel({ estimated: false, rateStatus: 'provisional' }), ' (rate-based, provisional rates)');
  assert.equal(costLabel({ estimated: true, rateStatus: 'provisional' }), ' (estimate, provisional rates)');
  assert.equal(costLabel({ estimated: true, rateStatus: 'unlabelled' }), ' (estimate, unlabelled rates)');
  assert.equal(costLabel({ usd: 1 }), ' (estimate, unlabelled rates)'); // missing labels fail toward caution
});

test('rate-level cacheWriteByRetention is validated too, so a malformed value can never reach pricing as NaN', async () => {
  const { validateRate, priceRequest } = await pricing();
  for (const bad of ['abc', -5, Number.NaN, null]) {
    assert.equal(validateRate({ ...tiered, cacheWriteByRetention: { '1h': bad } }), false, String(bad));
  }
  assert.equal(validateRate({ ...tiered, cacheWriteByRetention: { '7d': 1 } }), false);
  assert.equal(validateRate({ ...tiered, cacheWriteByRetention: { '1h': 3 } }), true);
  assert.equal(priceRequest({ input: 1, output: 1, cacheWrite: 5, cacheWrite1h: 5 }, { ...tiered, cacheWriteByRetention: { '1h': 'abc' } }).ok, false);
});

test('a verified exact cost is still labelled rate-based, never plain billing', async () => {
  const { costLabel } = await pricing();
  assert.equal(costLabel({ estimated: false, rateStatus: 'verified' }), ' (rate-based, verified rates)');
});

