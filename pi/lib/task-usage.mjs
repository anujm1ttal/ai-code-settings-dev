import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { priceRequest, validateRate } from './pricing.mjs';

const LIMIT = 65536;
const FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens', 'reasoning', 'cacheWrite1h'];
const CORE = FIELDS.slice(0, 5);
const DESTINATIONS = ['parent-model', 'calling-tool', 'child-model'];
const KINDS = ['normal', 'compaction', 'branch_summary', 'cache-warm'];
const STOPS = ['stop', 'toolUse', 'error', 'aborted', 'length'];
const AUDIT_TOOLS = new Set(['read', 'grep', 'find', 'ls', 'bash', 'powershell', 'edit', 'write', 'pi_role_agent', 'other']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const id = (type, value) => {
  if (typeof value !== 'string' || !value.length) throw new Error(`${type} identity required`);
  return digest(Buffer.from(JSON.stringify([type, value])));
};
const valid = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const ordinal = n => {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('invalid call ordinal');
  return n;
};
const isHash = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const json = value => Buffer.from(JSON.stringify(value));

// Runtime-local bindings are explicit and session scoped; ambiguity must not select a task.
const activeBindings = new Map();
export function getActiveTaskUsage(cwd, sessionId) {
  const bindings = activeBindings.get(path.resolve(cwd));
  if (!bindings) return undefined;
  if (typeof sessionId === 'string' && sessionId) return bindings.get(sessionId);
  return bindings.size === 1 ? bindings.values().next().value : undefined;
}

// Reject links at every project-local directory component; this is not a sandbox or a lock.
function directory(dir, create = false) {
  const root = path.parse(dir).root;
  let current = root;
  for (const part of dir.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (create) { try { fs.mkdirSync(current); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
    const st = fs.lstatSync(current);
    if (!st.isDirectory() || st.isSymbolicLink()) throw new Error('unsafe accounting directory');
  }
}
function regular(file) {
  const st = fs.lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink()) throw new Error('unsafe accounting file');
}
function publish(file, bytes) {
  const tmp = path.join(path.dirname(file), `.tmp-${randomBytes(16).toString('hex')}`);
  let exists = false;
  try {
    const fd = fs.openSync(tmp, 'wx', 0o600); exists = true;
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.linkSync(tmp, file);
    regular(file);
    if (!fs.readFileSync(file).equals(bytes)) throw new Error('publication readback mismatch');
  } finally { if (exists) fs.unlinkSync(tmp); }
}

// An accounting rate must price every token class: a flat rate needs all four prices, a tiered rate needs them on every tier.
const PRICE_FIELDS = ['inputPerMTok', 'outputPerMTok', 'cacheReadPerMTok', 'cacheWritePerMTok'];
const rateComplete = rate => validateRate(rate) &&
  (Object.hasOwn(rate, 'tiers') ? rate.tiers : [rate]).every(tier => PRICE_FIELDS.every(field => valid(tier[field])));

function reading(usage, rate) {
  const values = {}; const missing = {};
  for (const field of FIELDS) {
    const n = usage?.[field];
    missing[field] = !valid(n);
    if (!missing[field]) values[field] = n;
  }
  const subsetInvalid = (!missing.reasoning && (missing.output || values.reasoning > values.output)) ||
    (!missing.cacheWrite1h && (missing.cacheWrite || values.cacheWrite1h > values.cacheWrite));
  const known = CORE.every(field => !missing[field]) &&
    CORE.slice(0, 4).some(field => values[field] > 0) && !subsetInvalid;
  const priced = known && rateComplete(rate);
  const estimated = priced ? priceRequest(values, rate).usd : undefined; // each request picks its own tier
  const provider = usage?.cost?.total;
  const providerKnown = valid(provider) && (known || provider > 0);
  return { usage: values, missing, known, rateKnown: valid(estimated),
    ...(valid(estimated) ? { rateUsd: estimated } : {}),
    providerKnown, ...(providerKnown ? { providerUsd: provider } : {}) };
}

// A syntactically valid JSON object is not necessarily a journal record. Never trust or
// expose extra fields from a damaged journal as accounting data.
function validRow(row, previousHash) {
  if (!row || typeof row !== 'object' || Array.isArray(row) || row.version !== 1 || !valid(row.ts)) return false;
  if (previousHash === undefined ? Object.hasOwn(row, 'previousHash') : row.previousHash !== previousHash) return false;
  const common = ['version', 'ts', 'type', ...(previousHash === undefined ? [] : ['previousHash'])];
  let fields;
  switch (row.type) {
    case 'admit':
      fields = ['dispatchKey', 'toolKey'];
      if (!isHash(row.dispatchKey) || !isHash(row.toolKey)) return false;
      break;
    case 'parent': case 'child': case 'warm-result': {
      fields = ['usage', 'missing', 'known', 'rateKnown', 'providerKnown'];
      if (row.rateKnown) fields.push('rateUsd');
      if (row.providerKnown) fields.push('providerUsd');
      if (Object.hasOwn(row, 'modelKey')) fields.push('modelKey');
      if (Object.hasOwn(row, 'rateKey')) fields.push('rateKey');
      if ((Object.hasOwn(row, 'modelKey') && !isHash(row.modelKey)) ||
          (Object.hasOwn(row, 'rateKey') && !isHash(row.rateKey))) return false;
      if (row.type === 'parent') {
        fields.push('sessionKey', 'callOrdinal', 'kind');
        if (Object.hasOwn(row, 'entryKey')) {
          if (!isHash(row.entryKey)) return false;
          fields.push('entryKey');
        }
      }
      if (row.type === 'child') fields.push('dispatchKey', 'callOrdinal', 'stopReason');
      if (row.type === 'warm-result') fields.push('warmKey');
      if (row.type === 'parent' && (!isHash(row.sessionKey) || ![...KINDS, 'other'].includes(row.kind))) return false;
      if (row.type === 'child' && (!isHash(row.dispatchKey) || ![...STOPS, 'other'].includes(row.stopReason))) return false;
      if (row.type === 'warm-result' && !isHash(row.warmKey)) return false;
      if (row.type !== 'warm-result' && (!Number.isSafeInteger(row.callOrdinal) || row.callOrdinal < 0)) return false;
      if (typeof row.known !== 'boolean' || typeof row.rateKnown !== 'boolean' || typeof row.providerKnown !== 'boolean' ||
          (row.rateKnown && !valid(row.rateUsd)) || (row.providerKnown && !valid(row.providerUsd)) ||
          !row.usage || typeof row.usage !== 'object' || !row.missing || typeof row.missing !== 'object') return false;
      if (Object.keys(row.missing).length !== FIELDS.length || Object.keys(row.usage).some(k => !FIELDS.includes(k))) return false;
      for (const f of FIELDS) if (typeof row.missing[f] !== 'boolean' ||
          (row.missing[f] ? Object.hasOwn(row.usage, f) : !valid(row.usage[f]))) return false;
      if (row.known && (CORE.some(f => row.missing[f]) || !CORE.slice(0, 4).some(f => row.usage[f] > 0) ||
          (!row.missing.reasoning && row.usage.reasoning > row.usage.output) ||
          (!row.missing.cacheWrite1h && row.usage.cacheWrite1h > row.usage.cacheWrite))) return false;
      break;
    }
    case 'output':
      fields = ['destination', 'deliveryKey', 'bytes'];
      if (!DESTINATIONS.includes(row.destination) || !isHash(row.deliveryKey) || !Number.isSafeInteger(row.bytes) || row.bytes < 0) return false;
      break;
    case 'warm-intent': case 'warm-resolved': fields = ['warmKey']; if (!isHash(row.warmKey)) return false; break;
    case 'settlement':
      fields = ['dispatchKey', 'settlementHash', 'state'];
      if (Object.hasOwn(row, 'rateUsd')) fields.push('rateUsd');
      if (!isHash(row.dispatchKey) || !isHash(row.settlementHash) || !['succeeded', 'failed', 'cancelled', 'not-started'].includes(row.state) ||
          (Object.hasOwn(row, 'rateUsd') && (!valid(row.rateUsd) || row.state === 'not-started'))) return false;
      break;
    case 'conflict': fields = []; break;
    default: return false;
  }
  const allowed = new Set([...common, ...fields]);
  return Object.keys(row).length === allowed.size && Object.keys(row).every(k => allowed.has(k));
}

export function createTaskUsage({ cwd, clock = Date.now, rates = {}, ratesByModelKey = {}, fault = () => {} }) {
  if (typeof cwd !== 'string' || !cwd || typeof clock !== 'function' || typeof fault !== 'function') throw new Error('invalid accounting configuration');
  const artifacts = path.join(path.resolve(cwd), 'Artifacts');
  const agent = path.join(artifacts, '.agent');
  const base = path.join(agent, 'pi-accounting');
  let enabled = true; let current;
  const tasks = new Map(); const dispatches = new Map();
  const rateInfo = model => {
    const result = {};
    if (typeof model !== 'string' || !model) return { rate: undefined, identities: result };
    result.modelKey = id('model', model);
    const rate = Object.hasOwn(rates, model) ? rates[model] :
      (Object.hasOwn(ratesByModelKey, result.modelKey) ? ratesByModelKey[result.modelKey] : undefined);
    if (rateComplete(rate)) {
      // Canonical identity: prices and cache-write retention fields only (status and source are labels, not prices).
      // A legacy flat rate keeps its original four-price identity exactly.
      const priceTuple = t => [t.inputPerMTok, t.outputPerMTok, t.cacheReadPerMTok, t.cacheWritePerMTok];
      const byRetention = t => Object.entries(t.cacheWriteByRetention ?? {}).sort(([a], [b]) => (a < b ? -1 : 1));
      const retention = [rate.cacheWriteRetention ?? null, byRetention(rate)];
      const hasRetention = rate.cacheWriteRetention !== undefined || byRetention(rate).length > 0;
      const tiers = Object.hasOwn(rate, 'tiers') ? rate.tiers.map(t => [t.upToPromptTokens ?? null, ...priceTuple(t), byRetention(t)]) : undefined;
      result.rateKey = id('rate', JSON.stringify(tiers ? { tiers, retention } : (hasRetention ? [...priceTuple(rate), retention] : priceTuple(rate))));
    }
    return { rate, identities: result };
  };
  const assertEnabled = () => { if (!enabled) throw new Error('accounting disabled'); };
  const ensureBase = () => { directory(artifacts); directory(agent, true); directory(base, true); };
  const now = () => { const n = clock(); if (!valid(n)) throw new Error('invalid clock'); return n; };
  const taskDir = uid => path.join(base, uid);
  function state(uid) {
    if (!isHash(uid)) throw new Error('invalid task uid');
    if (tasks.has(uid)) return tasks.get(uid);
    const dir = taskDir(uid); directory(dir); regular(path.join(dir, 'binding.json'));
    const binding = JSON.parse(fs.readFileSync(path.join(dir, 'binding.json'), 'utf8'));
    if (binding.version !== 1 || binding.taskUid !== uid || !isHash(binding.taskKey) || !isHash(binding.sessionKey)) throw new Error('invalid binding');
    const t = { uid, dir, rows: [], damaged: false, segment: 0, size: 0, keys: new Map(), settlements: new Map() };
    tasks.set(uid, t);
    const segments = fs.readdirSync(dir).filter(name => /^events-\d+\.jsonl$/.test(name)).sort((a, b) => Number(a.slice(7, -6)) - Number(b.slice(7, -6)));
    let previous;
    outer: for (let i = 0; i < segments.length; i++) {
      const name = segments[i]; const num = Number(name.slice(7, -6));
      const file = path.join(dir, name); regular(file); const bytes = fs.readFileSync(file);
      if (num !== i || bytes.length > LIMIT || !bytes.length) { t.damaged = true; break; }
      const lines = bytes.toString('utf8').split('\n');
      for (let j = 0; j < lines.length - 1; j++) {
        try {
          const row = JSON.parse(lines[j]);
          if (!validRow(row, j === 0 && i > 0 ? previous : undefined)) { t.damaged = true; break outer; }
          apply(t, row);
        } catch { t.damaged = true; break outer; }
      }
      if (bytes.at(-1) !== 10) { t.damaged = true; break; }
      previous = digest(bytes); t.segment = num; t.size = bytes.length;
    }
    const checkpoints = fs.readdirSync(dir).filter(n => /^checkpoint-\d+\.json$/.test(n))
      .sort((a, b) => Number(a.slice(11, -5)) - Number(b.slice(11, -5)));
    if (checkpoints.length) {
      try {
        const checkpointFile = path.join(dir, checkpoints.at(-1)); regular(checkpointFile);
        const checkpoint = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
        if (checkpoint.version !== 1 || checkpoint.taskUid !== uid || !Number.isSafeInteger(checkpoint.segment) ||
            checkpoint.segment < 0 || !Number.isSafeInteger(checkpoint.segmentBytes) || checkpoint.segmentBytes < 0 ||
            checkpoint.segmentBytes > LIMIT || !isHash(checkpoint.segmentHash)) throw new Error('invalid checkpoint');
        const segmentFile = path.join(dir, `events-${checkpoint.segment}.jsonl`);
        let bytes = Buffer.alloc(0);
        if (fs.existsSync(segmentFile)) { regular(segmentFile); bytes = fs.readFileSync(segmentFile); }
        if (bytes.length < checkpoint.segmentBytes || digest(bytes.subarray(0, checkpoint.segmentBytes)) !== checkpoint.segmentHash) {
          throw new Error('checkpoint segment mismatch');
        }
      } catch { t.damaged = true; }
    }
    return t;
  }
  function loadAll() {
    if (!fs.existsSync(base)) return;
    directory(base);
    for (const uid of fs.readdirSync(base)) if (isHash(uid)) state(uid);
  }
  function refresh(t, force = false) {
    const file = path.join(t.dir, `events-${t.segment}.jsonl`);
    const next = path.join(t.dir, `events-${t.segment + 1}.jsonl`);
    if (!force && (t.size ? fs.existsSync(file) && fs.statSync(file).size === t.size : !fs.existsSync(file)) && !fs.existsSync(next)) return t;
    tasks.delete(t.uid);
    const refreshed = state(t.uid);
    if (current?.uid === t.uid) current = refreshed;
    return refreshed;
  }
  function keyFor(row) {
    if (row.type === 'parent') return `parent:${row.sessionKey}:${row.entryKey ?? row.callOrdinal}`;
    if (row.type === 'child') return `child:${row.dispatchKey}:${row.callOrdinal}`;
    if (row.type === 'output') return `output:${row.destination}:${row.deliveryKey}`;
    if (row.type === 'warm-intent' || row.type === 'warm-result' || row.type === 'warm-resolved') return `${row.type}:${row.warmKey}`;
    if (row.type === 'admit') return `admit:${row.dispatchKey}`;
    return undefined;
  }
  function comparable(row) {
    const copy = { ...row }; delete copy.previousHash; delete copy.ts;
    return JSON.stringify(copy);
  }
  function apply(t, row) {
    t.rows.push(row);
    const key = keyFor(row);
    if (key) {
      const old = t.keys.get(key);
      if (old && comparable(old) !== comparable(row)) t.damaged = true;
      else if (!old) t.keys.set(key, row);
    }
    if (row.type === 'admit') {
      const previous = dispatches.get(row.dispatchKey);
      if (previous && previous.uid !== t.uid) t.damaged = true;
      else dispatches.set(row.dispatchKey, t);
    }
    if (row.type === 'settlement') {
      const old = t.settlements.get(row.dispatchKey);
      if (old && old !== row.settlementHash) t.damaged = true;
      else t.settlements.set(row.dispatchKey, row.settlementHash);
    }
    if (row.type === 'conflict') t.damaged = true;
  }
  function append(t, data) {
    if (t.damaged) throw new Error('accounting journal incomplete; preserved for recovery');
    let row = { version: 1, ts: now(), ...data };
    let bytes = Buffer.from(`${JSON.stringify(row)}\n`);
    if (bytes.length > LIMIT) throw new Error('accounting row exceeds segment limit');
    if (t.size && t.size + bytes.length > LIMIT) {
      const previous = path.join(t.dir, `events-${t.segment}.jsonl`);
      row = { ...row, previousHash: digest(fs.readFileSync(previous)) };
      bytes = Buffer.from(`${JSON.stringify(row)}\n`);
      if (bytes.length > LIMIT) throw new Error('accounting row exceeds segment limit');
      t.segment++; t.size = 0;
    }
    const file = path.join(t.dir, `events-${t.segment}.jsonl`);
    const flags = t.size ? 'a' : 'wx';
    if (t.size) regular(file);
    const fd = fs.openSync(file, flags, 0o600);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    t.size += bytes.length; apply(t, row);
  }
  function conflict(t) {
    if (!t.damaged) append(t, { type: 'conflict' });
  }
  function add(t, row) {
    const key = keyFor(row); const old = key && t.keys.get(key);
    if (old) {
      if (comparable(old) !== comparable({ version: 1, ...row })) conflict(t);
      return;
    }
    append(t, row);
  }
  function requireCurrent() { if (!current) throw new Error('task binding required'); return current; }
  function summarize(t) {
    const totals = { promptInput: 0, output: 0, totalTokens: 0, rateUsdLowerBound: 0, providerUsdLowerBound: 0,
      deliveredBytes: { 'parent-model': 0, 'calling-tool': 0, 'child-model': 0 } };
    const observed = t.rows.some(row => ['parent', 'child', 'warm-result'].includes(row.type));
    let tokens = observed, rateCost = observed, providerDollars = observed, execution = !t.damaged && observed;
    const intents = new Set(); const results = new Set(); const seen = new Set();
    const admitted = new Set(); const settled = new Set(); const childCosts = new Map(); const settlements = [];
    for (const row of t.rows) {
      const key = keyFor(row);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      if (row.type === 'warm-intent') intents.add(row.warmKey);
      if (row.type === 'warm-result' || row.type === 'warm-resolved') results.add(row.warmKey);
      if (row.type === 'admit') admitted.add(row.dispatchKey);
      if (row.type === 'settlement') {
        settled.add(row.dispatchKey); settlements.push(row);
        if (!['succeeded', 'not-started'].includes(row.state)) execution = false;
      }
      if (row.type === 'output') totals.deliveredBytes[row.destination] += row.bytes;
      if (['parent', 'child', 'warm-result'].includes(row.type)) {
        if (!row.known) tokens = false;
        else {
          if (row.type !== 'child') totals.promptInput += row.usage.input + row.usage.cacheRead + row.usage.cacheWrite;
          totals.output += row.usage.output; totals.totalTokens += row.usage.totalTokens;
        }
        if (row.rateKnown) {
          totals.rateUsdLowerBound += row.rateUsd;
          if (row.type === 'child') childCosts.set(row.dispatchKey, (childCosts.get(row.dispatchKey) ?? 0) + row.rateUsd);
        } else rateCost = false;
        if (row.providerKnown) totals.providerUsdLowerBound += row.providerUsd; else providerDollars = false;
        if (row.type === 'child' && ['error', 'aborted', 'other'].includes(row.stopReason)) execution = false;
      }
    }
    if ([...intents].some(key => !results.has(key)) || [...admitted].some(key => !settled.has(key))) execution = false;
    for (const row of settlements) {
      const recorded = childCosts.get(row.dispatchKey) ?? 0;
      if (valid(row.rateUsd) && row.rateUsd > recorded) totals.rateUsdLowerBound += row.rateUsd - recorded;
      if (row.state !== 'not-started' && !t.rows.some(r => r.type === 'child' && r.dispatchKey === row.dispatchKey)) {
        tokens = false; rateCost = false; providerDollars = false;
      }
    }
    const completeness = { tokens: tokens ? 'COMPLETE' : 'INCOMPLETE', rateCost: rateCost ? 'COMPLETE' : 'INCOMPLETE',
      providerDollars: providerDollars ? 'COMPLETE' : 'INCOMPLETE', execution: execution ? 'COMPLETE' : 'INCOMPLETE' };
    return { status: Object.values(completeness).every(v => v === 'COMPLETE') ? 'COMPLETE' : 'INCOMPLETE',
      totals, completeness, rows: structuredClone(t.rows) };
  }
  let boundSession;
  const api = {
    bind({ taskId, sessionId, actor }) {
      assertEnabled(); if (actor !== 'parent') throw new Error('parent binding required');
      const taskKey = id('task', taskId); const sessionKey = id('session', sessionId);
      ensureBase();
      const taskUid = digest(randomBytes(32)); const dir = taskDir(taskUid); directory(dir, true);
      publish(path.join(dir, 'binding.json'), json({ version: 1, taskUid, taskKey, sessionKey, ts: now() }));
      current = state(taskUid);
      const root = path.resolve(cwd);
      if (boundSession && activeBindings.get(root)?.get(boundSession) === api) activeBindings.get(root).delete(boundSession);
      boundSession = sessionId;
      if (!activeBindings.has(root)) activeBindings.set(root, new Map());
      activeBindings.get(root).set(sessionId, api);
      return { taskUid };
    },
    restore({ taskUid, sessionId }) {
      assertEnabled();
      const sessionKey = id('session', sessionId);
      const t = state(taskUid);
      const binding = JSON.parse(fs.readFileSync(path.join(t.dir, 'binding.json'), 'utf8'));
      if (binding.sessionKey !== sessionKey) throw new Error('session binding mismatch');
      current = t;
      const root = path.resolve(cwd);
      if (boundSession && activeBindings.get(root)?.get(boundSession) === api) activeBindings.get(root).delete(boundSession);
      boundSession = sessionId;
      if (!activeBindings.has(root)) activeBindings.set(root, new Map());
      activeBindings.get(root).set(sessionId, api);
    },
    admit({ dispatchId, toolCallId }) {
      assertEnabled(); const t = refresh(requireCurrent()); const dispatchKey = id('dispatch', dispatchId); const toolKey = id('tool-call', toolCallId);
      loadAll(); const existing = dispatches.get(dispatchKey);
      if (existing && existing !== t) { conflict(existing); throw new Error('dispatch already admitted to another task'); }
      add(t, { type: 'admit', dispatchKey, toolKey }); return { dispatchKey };
    },
    record(event) {
      assertEnabled(); if (!event || typeof event !== 'object') throw new Error('record required');
      let t = event.type === 'child' ? undefined : requireCurrent(); let row;
      if (event.type === 'parent' || event.type === 'child') {
        const callOrdinal = ordinal(event.callOrdinal);
        const { rate, identities } = rateInfo(event.model);
        const fields = { ...identities, ...reading(event.usage, rate) };
        if (event.type === 'parent') row = { type: 'parent', sessionKey: id('session', event.sessionId), callOrdinal,
          ...(event.entryId !== undefined ? { entryKey: id('entry', event.entryId) } : {}),
          kind: KINDS.includes(event.kind) ? event.kind : 'other', ...fields };
        else {
          if (!isHash(event.dispatchKey)) throw new Error('invalid dispatch key');
          loadAll(); t = dispatches.get(event.dispatchKey); if (!t) throw new Error('dispatch not admitted');
          row = { type: 'child', dispatchKey: event.dispatchKey, callOrdinal,
            stopReason: STOPS.includes(event.stopReason) ? event.stopReason : 'other', ...fields };
        }
      } else if (event.type === 'output') {
        if (!DESTINATIONS.includes(event.destination) || typeof event.text !== 'string') throw new Error('invalid output');
        row = { type: 'output', destination: event.destination, deliveryKey: id('delivery', event.deliveryId), bytes: Buffer.byteLength(event.text) };
      } else if (event.type === 'warm-intent' || event.type === 'warm-result' || event.type === 'warm-resolved') {
        row = { type: event.type, warmKey: id('warm', event.id) };
        if (event.type === 'warm-result') {
          const { rate, identities } = rateInfo(event.model);
          Object.assign(row, identities, reading(event.usage, rate));
        }
      } else throw new Error('unknown record type');
      t = refresh(t); add(t, row);
    },
    markNotStarted({ dispatchKey }) {
      assertEnabled(); if (!isHash(dispatchKey)) throw new Error('invalid dispatch key');
      loadAll(); let t = dispatches.get(dispatchKey); if (!t) throw new Error('dispatch not admitted');
      t = refresh(t);
      if (t.rows.some(row => row.type === 'child' && row.dispatchKey === dispatchKey)) throw new Error('dispatch already started');
      const settlementHash = id('not-started', dispatchKey);
      const prior = t.settlements.get(dispatchKey);
      if (prior) { if (prior !== settlementHash) throw new Error('dispatch already settled'); return; }
      append(t, { type: 'settlement', dispatchKey, settlementHash, state: 'not-started' });
    },
    reconcile({ dispatchId, bytes, sha256 }) {
      assertEnabled(); const dispatchKey = id('dispatch', dispatchId); loadAll();
      let t = dispatches.get(dispatchKey); if (!t) throw new Error('dispatch not admitted');
      t = refresh(t);
      let settlement;
      try {
        if (!Buffer.isBuffer(bytes) || !isHash(sha256) || digest(bytes) !== sha256) throw new Error('invalid settlement hash');
        settlement = JSON.parse(bytes.toString('utf8'));
        if (settlement.version !== 1 || settlement.dispatchId !== dispatchId || !['succeeded', 'failed', 'cancelled'].includes(settlement.state)) throw new Error('invalid settlement');
      } catch { conflict(t); return; }
      const prior = t.settlements.get(dispatchKey);
      if (prior) { if (prior !== sha256) conflict(t); return; }
      const cost = settlement.cost?.usd;
      append(t, { type: 'settlement', dispatchKey, settlementHash: sha256, state: settlement.state,
        ...(valid(cost) && cost > 0 ? { rateUsd: cost } : {}) });
    },
    checkpoint() {
      assertEnabled(); const t = refresh(requireCurrent());
      fault('before-flush');
      // Rows are fsynced at append; explicitly flush every existing segment before publishing.
      for (const name of fs.readdirSync(t.dir).filter(n => /^events-\d+\.jsonl$/.test(n))) {
        const file = path.join(t.dir, name); regular(file); const fd = fs.openSync(file, 'r+');
        try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      }
      fault('after-flush');
      const seq = Math.max(0, ...fs.readdirSync(t.dir).map(n => /^checkpoint-(\d+)\.json$/.exec(n)).filter(Boolean).map(m => Number(m[1]))) + 1;
      const file = path.join(t.dir, `checkpoint-${seq}.json`);
      const s = summarize(t);
      const segmentFile = path.join(t.dir, `events-${t.segment}.jsonl`);
      const segmentBytes = t.size ? fs.readFileSync(segmentFile) : Buffer.alloc(0);
      const bytes = json({ version: 1, taskUid: t.uid, sequence: seq, ts: now(), status: s.status,
        totals: s.totals, completeness: s.completeness, segment: t.segment, segmentBytes: t.size,
        segmentHash: digest(segmentBytes) });
      fault('before-publish'); publish(file, bytes); fault('after-publish');
      fault('before-rotate');
      const log = path.join(agent, 'pi-audit.jsonl');
      // Retain only canonical metadata, including earlier checkpoint records. Read a bounded
      // tail and discard a partial first line; older rows cannot fit the byte ceiling.
      let rows = [];
      if (fs.existsSync(log)) {
        regular(log);
        const fd = fs.openSync(log, 'r');
        try {
          const size = fs.fstatSync(fd).size;
          const tail = Buffer.alloc(Math.min(size, LIMIT));
          fs.readSync(fd, tail, 0, tail.length, size - tail.length);
          rows = tail.toString('utf8').split('\n');
          if (size > tail.length) rows.shift();
        } finally { fs.closeSync(fd); }
      }
      const checkpointRow = { version: 1, ts: now(), type: 'checkpoint', taskUid: t.uid, sequence: seq, checkpointHash: digest(bytes) };
      const kept = [`${JSON.stringify(checkpointRow)}\n`];
      let retainedBytes = Buffer.byteLength(kept[0]);
      for (const raw of rows.reverse()) {
        let row; try { row = JSON.parse(raw); } catch { continue; }
        let safe;
        if (typeof row?.ts === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(row.ts) &&
            AUDIT_TOOLS.has(row.tool) && ['ok', 'error'].includes(row.outcome)) {
          safe = { ts: row.ts, tool: row.tool, outcome: row.outcome };
        } else if (row?.version === 1 && row.type === 'checkpoint' && valid(row.ts) && isHash(row.taskUid) &&
            Number.isSafeInteger(row.sequence) && row.sequence > 0 && isHash(row.checkpointHash)) {
          safe = { version: 1, ts: row.ts, type: 'checkpoint', taskUid: row.taskUid, sequence: row.sequence, checkpointHash: row.checkpointHash };
        } else continue;
        const line = `${JSON.stringify(safe)}\n`; const length = Buffer.byteLength(line);
        if (retainedBytes + length > LIMIT) break;
        kept.unshift(line); retainedBytes += length;
      }
      const audit = Buffer.from(kept.join(''));
      const tmp = path.join(agent, `.audit-${randomBytes(16).toString('hex')}.tmp`);
      let created = false;
      try {
        const fd = fs.openSync(tmp, 'wx', 0o600); created = true;
        try { fs.writeFileSync(fd, audit); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        if (!fs.readFileSync(tmp).equals(audit)) throw new Error('audit readback mismatch');
        fs.renameSync(tmp, log); created = false;
        if (!fs.readFileSync(log).equals(audit)) throw new Error('audit publication mismatch');
      } finally { if (created) fs.unlinkSync(tmp); }
      fault('after-rotate'); return { path: file };
    },
    status({ taskUid } = {}) { const t = taskUid ? state(taskUid) : requireCurrent(); return summarize(refresh(t, true)); },
    markIncomplete() { assertEnabled(); const t = refresh(requireCurrent()); conflict(t); },
    isEnabled() { return enabled; },
    deactivate() { unregister(); },
    close() { enabled = false; unregister(); },
    disable() { enabled = false; unregister(); },
  };
  function unregister() {
    const root = path.resolve(cwd); const bindings = activeBindings.get(root);
    if (bindings?.get(boundSession) === api) bindings.delete(boundSession);
    if (bindings?.size === 0) activeBindings.delete(root);
  }
  return api;
}
