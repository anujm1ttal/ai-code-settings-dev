import { priceAggregate, priceRequests, validateRate } from './pricing.mjs';

// Picodollars keep ordinary fractional-dollar budgets and comparisons free of float drift.
const SCALE = 1e12;
const validTokens = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function createJobBudget({ perJobUsd, perSessionUsd, rates, modelOf }) {
  const perJob = Math.max(1, Math.round(perJobUsd * SCALE));
  const perSession = Math.round(perSessionUsd * SCALE);
  const reservations = new WeakMap();
  let spent = 0;
  let reserved = 0;
  return {
    reserve(role) {
      const model = modelOf(role);
      const rate = Object.hasOwn(rates, model) ? rates[model] : undefined;
      if (!rate) throw new Error(`no job rate configured for ${model}`);
      if (!validateRate(rate)) throw new Error(`invalid job rate for ${model}`);
      if (spent + reserved + perJob > perSession) throw new Error('session job budget exhausted');
      const reservation = {};
      reservations.set(reservation, { rate: structuredClone(rate), settled: false });
      reserved += perJob;
      return reservation;
    },
    settle(reservation, usage, usageCalls) {
      const entry = reservations.get(reservation);
      if (!entry) throw new Error('Unknown job reservation');
      if (entry.settled) return entry.result;
      entry.settled = true;
      if (!usage || !validTokens(usage.input) || !validTokens(usage.output) ||
          (usage.cacheRead !== undefined && !validTokens(usage.cacheRead)) ||
          (usage.cacheWrite !== undefined && !validTokens(usage.cacheWrite))) return undefined;
      // The runner starts usage at zero, so an all-zero reading means the child reported none: keep the reservation.
      if (usage.input + usage.output + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0) === 0) return undefined;
      // Prefer the per-request breakdown (each call picks its own tier) when it is complete and adds up to the aggregate;
      // otherwise price the aggregate at the highest tier and label it an estimate.
      const fields = ['input', 'output', 'cacheRead', 'cacheWrite'];
      const sum = (key) => (usageCalls ?? []).reduce((total, call) => total + (call?.usage?.[key] ?? 0), 0);
      const usable = Array.isArray(usageCalls) && usageCalls.length > 0 &&
        usageCalls.every((call) => call?.completeness === 'known' && call.usage !== null && typeof call.usage === 'object') &&
        fields.every((key) => sum(key) === (usage[key] ?? 0));
      let priced = usable ? priceRequests(usageCalls.map((call) => call.usage), entry.rate) : { ok: false };
      if (!priced.ok) priced = priceAggregate(usage, entry.rate); // malformed per-request calls fall back to the labelled estimate
      if (!priced.ok || !Number.isFinite(priced.usd) || priced.usd < 0) return undefined; // never let a bad price corrupt spend
      const raw = priced.usd;
      const actual = Math.round(raw * SCALE);
      reserved -= perJob;
      spent += actual;
      entry.result = { usd: actual / SCALE, overBudget: actual > perJob, estimated: priced.estimated, rateStatus: priced.rateStatus };
      return entry.result;
    },
    snapshot() {
      return { spentUsd: spent / SCALE, reservedUsd: reserved / SCALE,
        remainingUsd: Math.max(0, perSession - spent - reserved) / SCALE, perJobUsd, perSessionUsd };
    },
  };
}
