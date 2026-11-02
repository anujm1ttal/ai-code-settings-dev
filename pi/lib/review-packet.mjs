import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const STAGES = Object.freeze(['comprehension', 'antagonistic', 'readiness']);
const keys = ['stage', 'packetSha256', 'constraintsSha256', 'instructionsSha256', 'tools', 'prompt', 'parts'];
const kinds = ['instructions', 'constraints', 'packet'];
const hex = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const hash = text => createHash('sha256').update(text, 'utf8').digest('hex');
const bytes = text => Buffer.byteLength(text, 'utf8');
const validText = text => typeof text === 'string' && text.isWellFormed() && text.trim().length > 0 && bytes(text) <= 65536 && !text.includes('<<<') && !text.includes('>>>');
const MAX_PROMPT_BYTES = 3 * 65536 + 1024;
const fail = reason => ({ ok: false, reason });

function promptFor(stage, texts, hashes) {
  return `<<<INSTRUCTIONS stage=${stage} sha256=${hashes.instructions}>>>\n${texts.instructions}\n<<<CONSTRAINTS sha256=${hashes.constraints}>>>\n${texts.constraints}\n<<<PACKET sha256=${hashes.packet}>>>\n${texts.packet}\n<<<END>>>`;
}

export function buildReviewRequest({ packet, stage, instructions, constraints }) {
  if (!STAGES.includes(stage)) throw new Error('Invalid stage');
  const texts = { instructions, constraints, packet };
  for (const kind of kinds) {
    if (!validText(texts[kind])) throw new Error(`Invalid ${kind}`);
  }
  const hashes = Object.fromEntries(kinds.map(kind => [kind, hash(texts[kind])]));
  const parts = Object.freeze(kinds.map(kind => Object.freeze({ kind, sha256: hashes[kind], bytes: bytes(texts[kind]) })));
  return Object.freeze({
    stage, packetSha256: hashes.packet, constraintsSha256: hashes.constraints,
    instructionsSha256: hashes.instructions, tools: Object.freeze([]),
    prompt: promptFor(stage, texts, hashes), parts,
  });
}

// Snapshot own data properties without ever invoking an input getter.
function record(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || types.isProxy(value)) return null;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const names = Reflect.ownKeys(descriptors);
  if (names.some(name => typeof name !== 'string' || name === '__proto__' || !('value' in descriptors[name]))) return null;
  const result = Object.create(null);
  for (const name of names) result[name] = descriptors[name].value;
  return result;
}

function arrayValues(value) {
  if (!Array.isArray(value) || types.isProxy(value)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > 3) return null;
  const names = Reflect.ownKeys(descriptors);
  if (names.length !== length + 1 || !names.includes('length')) return null;
  const result = [];
  for (let i = 0; i < length; i++) {
    const descriptor = descriptors[i];
    if (!descriptor || !('value' in descriptor)) return null;
    result.push(descriptor.value);
  }
  return result;
}

export function validateReviewRequest(request, approved) {
  try {
    const req = record(request);
    if (!req) return fail('request object');
    const auth = record(approved);
    if (!auth) return fail('approved object');
    const names = Object.keys(req);
    if (names.length !== keys.length || keys.some(key => !Object.hasOwn(req, key))) return fail('request keys');
    if (!STAGES.includes(req.stage)) return fail('stage');
    const tools = arrayValues(req.tools);
    if (!tools || tools.length !== 0) return fail('tools');
    const parts = arrayValues(req.parts);
    if (!parts || parts.length !== 3) return fail('parts');
    if (![req.packetSha256, req.constraintsSha256, req.instructionsSha256].every(hex)) return fail('hash');
    if (typeof req.prompt !== 'string') return fail('prompt');
    if (Buffer.byteLength(req.prompt) > MAX_PROMPT_BYTES) return fail('prompt');
    // Linear parse: texts cannot contain '<<<', so a valid prompt splits into exactly five pieces (no backtracking regex over the whole prompt).
    const pieces = req.prompt.split('<<<');
    const head = pieces.length === 5 && pieces[0] === '' && /^INSTRUCTIONS stage=([^\s>]+) sha256=([0-9a-f]{64})>>>\n([\s\S]*)\n$/.exec(pieces[1]);
    const cons = head && /^CONSTRAINTS sha256=([0-9a-f]{64})>>>\n([\s\S]*)\n$/.exec(pieces[2]);
    const pack = cons && /^PACKET sha256=([0-9a-f]{64})>>>\n([\s\S]*)\n$/.exec(pieces[3]);
    const match = pack && pieces[4] === 'END>>>' && [null, head[1], head[2], head[3], cons[1], cons[2], pack[1], pack[2]];
    if (!match || match[1] !== req.stage) return fail('prompt');
    const texts = { instructions: match[3], constraints: match[5], packet: match[7] };
    if (!kinds.every(kind => validText(texts[kind]))) return fail('prompt');
    const hashes = Object.fromEntries(kinds.map(kind => [kind, hash(texts[kind])]));
    if (match[2] !== hashes.instructions || match[4] !== hashes.constraints || match[6] !== hashes.packet || req.prompt !== promptFor(req.stage, texts, hashes)) return fail('prompt');
    if (req.instructionsSha256 !== hashes.instructions || req.constraintsSha256 !== hashes.constraints || req.packetSha256 !== hashes.packet) return fail('hash');
    for (let i = 0; i < kinds.length; i++) {
      const part = record(parts[i]);
      const kind = kinds[i];
      if (!part || Object.keys(part).length !== 3 || !Object.hasOwn(part, 'kind') || !Object.hasOwn(part, 'sha256') || !Object.hasOwn(part, 'bytes') || part.kind !== kind || part.sha256 !== hashes[kind] || part.bytes !== bytes(texts[kind])) return fail('parts');
    }
    if (!hex(auth.packetSha256) || auth.packetSha256 !== req.packetSha256) return fail('packet approval');
    if (!hex(auth.constraintsSha256) || auth.constraintsSha256 !== req.constraintsSha256) return fail('constraints approval');
    const instructions = record(auth.instructionsByStage);
    if (!instructions || !Object.hasOwn(instructions, req.stage) || !hex(instructions[req.stage]) || instructions[req.stage] !== req.instructionsSha256) return fail('instructions approval');
    if (![request, req.tools, req.parts, ...req.parts].every(Object.isFrozen)) return fail('frozen');
    return { ok: true };
  } catch {
    return fail('malformed input');
  }
}
