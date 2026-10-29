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
      if (spent + reserved + perJob > perSession) throw new Error('session job budget exhausted');
      const reservation = {};
      reservations.set(reservation, { rate: { ...rate }, settled: false });
      reserved += perJob;
      return reservation;
    },
    settle(reservation, usage) {
      const entry = reservations.get(reservation);
      if (!entry) throw new Error('Unknown job reservation');
      if (entry.settled) return entry.result;
      entry.settled = true;
      if (!usage || !validTokens(usage.input) || !validTokens(usage.output) ||
          (usage.cacheRead !== undefined && !validTokens(usage.cacheRead)) ||
          (usage.cacheWrite !== undefined && !validTokens(usage.cacheWrite))) return undefined;
      // The runner starts usage at zero, so an all-zero reading means the child reported none: keep the reservation.
      if (usage.input + usage.output + (usage.cacheRead ?? 0) + (usage.cacheWrite ?? 0) === 0) return undefined;
      const rate = entry.rate;
      const raw = (usage.input * rate.inputPerMTok + usage.output * rate.outputPerMTok +
        (usage.cacheRead ?? 0) * (rate.cacheReadPerMTok ?? rate.inputPerMTok) +
        (usage.cacheWrite ?? 0) * (rate.cacheWritePerMTok ?? rate.inputPerMTok)) / 1e6;
      const actual = Math.round(raw * SCALE);
      reserved -= perJob;
      spent += actual;
      entry.result = { usd: actual / SCALE, overBudget: actual > perJob };
      return entry.result;
    },
    snapshot() {
      return { spentUsd: spent / SCALE, reservedUsd: reserved / SCALE,
        remainingUsd: Math.max(0, perSession - spent - reserved) / SCALE, perJobUsd, perSessionUsd };
    },
  };
}
