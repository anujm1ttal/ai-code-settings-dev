// Tier-aware token pricing. Pure functions; no I/O.
//
// A rate is either FLAT (inputPerMTok, outputPerMTok, optional cacheReadPerMTok, cacheWritePerMTok) or TIERED
// (`tiers`: ordered by `upToPromptTokens`, inclusive, strictly increasing; the last tier has no limit).
// The tier is chosen per API request from that request's own prompt size, input + cacheRead + cacheWrite,
// and applies to every token class of that request (output included). Cumulative session totals never pick a tier.
//
// Optional metadata, all additive so existing flat policy rates keep working unchanged:
//   status               'verified' | 'provisional' (absent = 'unlabelled'); costs are totalled per status, never mixed
//   source               free-text provenance of the rates
//   cacheWriteRetention  which retention `cacheWritePerMTok` prices ('5m' | '30m' | '1h'); absent = unspecified
//   cacheWriteByRetention  { '1h': price, ... } alternate cache-write prices, per tier or on a flat rate
// A rate never gets a retention, threshold or surcharge assumed on its behalf: an unspecified or unpriced cache-write
// retention is priced at cacheWritePerMTok and labelled an estimate.

const RETENTIONS = new Set(['5m', '30m', '1h']);
const STATUSES = new Set(['verified', 'provisional']);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const nonNeg = (v) => num(v) && v >= 0;
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const retentionMapOk = (t) => !Object.hasOwn(t, 'cacheWriteByRetention') || (object(t.cacheWriteByRetention) &&
  Object.entries(t.cacheWriteByRetention).every(([k, v]) => RETENTIONS.has(k) && nonNeg(v)));

function priceFieldsOk(t) {
  return num(t.inputPerMTok) && t.inputPerMTok >= 0 && num(t.outputPerMTok) && t.outputPerMTok >= 0 &&
    ['cacheReadPerMTok', 'cacheWritePerMTok'].every((k) => !Object.hasOwn(t, k) || nonNeg(t[k])) && retentionMapOk(t);
}

export function validateRate(rate) {
  if (!object(rate)) return false;
  if (Object.hasOwn(rate, 'status') && !STATUSES.has(rate.status)) return false;
  if (Object.hasOwn(rate, 'source') && typeof rate.source !== 'string') return false;
  if (Object.hasOwn(rate, 'cacheWriteRetention') && !RETENTIONS.has(rate.cacheWriteRetention)) return false;
  if (!Object.hasOwn(rate, 'tiers')) return priceFieldsOk(rate);
  if (!retentionMapOk(rate)) return false; // a rate-level map on a tiered rate is used as the fallback, so it must be valid too
  const { tiers } = rate;
  if (!Array.isArray(tiers) || tiers.length === 0) return false;
  let previous = 0;
  for (const [index, tier] of tiers.entries()) {
    if (!object(tier) || !priceFieldsOk(tier)) return false;
    const last = index === tiers.length - 1;
    if (Object.hasOwn(tier, 'upToPromptTokens')) {
      if (last || !num(tier.upToPromptTokens) || tier.upToPromptTokens <= previous) return false;
      previous = tier.upToPromptTokens;
    } else if (!last) return false;
  }
  return true;
}

const tiersOf = (rate) => (Object.hasOwn(rate, 'tiers') ? rate.tiers : [rate]);
const statusOf = (rate) => (STATUSES.has(rate.status) ? rate.status : 'unlabelled');
const tokens = (usage, key) => (usage[key] === undefined ? 0 : usage[key]);

function usageOk(usage) {
  return object(usage) && nonNeg(usage.input) && nonNeg(usage.output) &&
    ['cacheRead', 'cacheWrite', 'cacheWrite1h'].every((k) => usage[k] === undefined || nonNeg(usage[k]));
}

function price(usage, rate, tierIndex, { cacheRetention, estimatedBy = [] } = {}) {
  const tier = tiersOf(rate)[tierIndex];
  const reasons = [...estimatedBy];
  const input = tier.inputPerMTok;
  const readPrice = tier.cacheReadPerMTok ?? input;
  const writePrice = tier.cacheWritePerMTok ?? input; // cache defaults to the input price, as job budgets always did
  const retention = cacheRetention ?? rate.cacheWriteRetention;
  const byRetention = tier.cacheWriteByRetention ?? rate.cacheWriteByRetention ?? {};
  const cacheWrite = tokens(usage, 'cacheWrite');
  const observed1h = Math.min(tokens(usage, 'cacheWrite1h'), cacheWrite); // 1h tokens are a subset of cacheWrite
  let writeCost = 0;
  let remaining = cacheWrite;
  if (observed1h > 0) {
    if (Object.hasOwn(byRetention, '1h')) writeCost += observed1h * byRetention['1h'];
    else { writeCost += observed1h * writePrice; reasons.push('no 1h cache-write price configured; default cache-write price used for 1h tokens'); }
    remaining -= observed1h;
  }
  if (remaining > 0) {
    if (retention === undefined) {
      writeCost += remaining * writePrice;
      reasons.push('cache-write retention unspecified; default cache-write price used');
    } else if (retention === rate.cacheWriteRetention) {
      writeCost += remaining * writePrice;
    } else if (Object.hasOwn(byRetention, retention)) {
      writeCost += remaining * byRetention[retention];
    } else {
      writeCost += remaining * writePrice;
      reasons.push(`no ${retention} cache-write price configured; default cache-write price used`);
    }
  }
  // Same operation order as the original job-budget formula so flat rates reproduce identical dollars.
  const usd = (usage.input * input + usage.output * tier.outputPerMTok + tokens(usage, 'cacheRead') * readPrice + writeCost) / 1e6;
  return { ok: true, usd, tier: tierIndex, promptTokens: usage.input + tokens(usage, 'cacheRead') + cacheWrite,
    estimated: reasons.length > 0, reasons, rateStatus: statusOf(rate) };
}

export function priceRequest(usage, rate, options = {}) {
  if (!usageOk(usage)) return { ok: false, reason: 'invalid or missing token usage' };
  if (!validateRate(rate)) return { ok: false, reason: 'invalid rate' };
  const promptTokens = usage.input + tokens(usage, 'cacheRead') + tokens(usage, 'cacheWrite');
  const tiers = tiersOf(rate);
  let index = tiers.findIndex((tier) => tier.upToPromptTokens === undefined || promptTokens <= tier.upToPromptTokens);
  if (index < 0) index = tiers.length - 1;
  return price(usage, rate, index, options);
}

// Per-request breakdown unavailable: the tier cannot be determined, so the highest tier is applied (an upper bound)
// and the result is always labelled an estimate.
export function priceAggregate(usage, rate, options = {}) {
  if (!usageOk(usage)) return { ok: false, reason: 'invalid or missing token usage' };
  if (!validateRate(rate)) return { ok: false, reason: 'invalid rate' };
  return price(usage, rate, tiersOf(rate).length - 1,
    { ...options, estimatedBy: ['per-request token breakdown unavailable; highest tier applied'] });
}

export function priceRequests(requests, rate, options = {}) {
  if (!Array.isArray(requests) || requests.length === 0) return { ok: false, reason: 'no requests' };
  const results = [];
  for (const usage of requests) {
    const result = priceRequest(usage, rate, options);
    if (!result.ok) return { ok: false, reason: result.reason };
    results.push(result);
  }
  return { ok: true, usd: results.reduce((sum, r) => sum + r.usd, 0), estimated: results.some((r) => r.estimated),
    reasons: [...new Set(results.flatMap((r) => r.reasons))], rateStatus: results[0].rateStatus, requests: results };
}

// Totals per rate status so verified and provisional dollars are never silently blended.
export function summarizeCosts(results) {
  const out = { verifiedUsd: 0, provisionalUsd: 0, unlabelledUsd: 0, totalUsd: 0, estimated: false };
  for (const r of results) {
    if (!r?.ok) continue;
    out[`${r.rateStatus}Usd`] += r.usd; out.totalUsd += r.usd; out.estimated ||= r.estimated;
  }
  return out;
}

// Display suffix for a settled cost. Missing labels are treated as an unlabelled estimate, so nothing is shown as billing by default.
export function costLabel(cost) {
  const estimated = cost?.estimated !== false;
  const status = STATUSES.has(cost?.rateStatus) || cost?.rateStatus === 'unlabelled' ? cost.rateStatus : 'unlabelled';
  // Rate-derived dollars are never provider billing, so even an exact verified cost carries a label.
  return ` (${estimated ? 'estimate' : 'rate-based'}, ${status} rates)`;
}
