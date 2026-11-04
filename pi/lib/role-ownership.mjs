import fs from 'node:fs';
import path from 'node:path';

// Service state names are also protected outside their usual .agent directory.
export const PROTECTED_FLOOR = Object.freeze([
  'Artifacts/Evidence/**', 'Artifacts/.agent/**', 'Artifacts/BACKLOG.md',
  'Artifacts/learnings/**', 'Artifacts/GLOBAL_INBOX.md', 'role-ownership.json',
  '**/bulk-read-approval.json', '**/bulk-read-ledger.jsonl', '**/bulk-read-ledger.lock',
]);
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const keys = (x, expected) => isObject(x) && Object.keys(x).length === expected.length && expected.every(k => Object.hasOwn(x, k));
const fail = message => { throw new Error(message); };
const fold = s => s.toLowerCase();

function patternValid(p) {
  return typeof p === 'string' && p.length > 0 && !/[\\\0:!\[\]{}()?+|^$]/.test(p) &&
    !p.startsWith('/') && p.split('/').every(s => s && s !== '.' && s !== '..' && (!s.includes('**') || s === '**'));
}
function list(value, label, pattern = true) {
  if (!Array.isArray(value) || Array.from(value).some(x => pattern ? !patternValid(x) : typeof x !== 'string' || !x.length) || new Set(value.map(fold)).size !== value.length) fail(`invalid ${label}`);
  return Object.freeze([...value]);
}
function match(pattern, target) {
  const ps = fold(pattern).split('/'), ts = fold(target).split('/');
  const memo = new Map();
  function visit(i, j) {
    const key = `${i},${j}`; if (memo.has(key)) return memo.get(key);
    let result;
    if (i === ps.length) result = j === ts.length;
    else if (ps[i] === '**') result = visit(i + 1, j) || (j < ts.length && visit(i, j + 1));
    else {
      const re = new RegExp(`^${ps[i].split('*').map(s => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')).join('[\\s\\S]*')}$(?![\\s\\S])`);
      result = j < ts.length && re.test(ts[j]) && visit(i + 1, j + 1);
    }
    memo.set(key, result); return result;
  }
  return visit(0, 0);
}
function obviousOverlap(a, b) {
  // Try a concrete member of each language; this is intentionally not a complete glob-intersection solver.
  const witness = p => p.replace(/\*\*/g, 'x').replace(/\*/g, 'x');
  return fold(a) === fold(b) || match(b, witness(a)) || match(a, witness(b));
}
export function validateOwnershipPolicy(obj) {
  if (!keys(obj, ['version', 'roles', 'protected', 'approvalLinePrefixes']) || obj.version !== 1 || !keys(obj.roles, ['strategist', 'coder', 'auditor', 'scribe'])) fail('invalid policy');
  const r = obj.roles;
  if (!keys(r.strategist, ['plans', 'todos']) || !keys(r.coder, ['residual', 'generated']) || !keys(r.auditor, ['todos']) || !keys(r.scribe, ['docs']) || r.coder.residual !== true) fail('invalid role fields');
  const roles = Object.freeze({
    strategist: Object.freeze({ plans: list(r.strategist.plans, 'plans'), todos: list(r.strategist.todos, 'todos') }),
    coder: Object.freeze({ residual: true, generated: list(r.coder.generated, 'generated') }),
    auditor: Object.freeze({ todos: list(r.auditor.todos, 'auditor todos') }),
    scribe: Object.freeze({ docs: list(r.scribe.docs, 'docs') }),
  });
  const { strategist: s, auditor: a, coder: c, scribe: d } = roles;
  if (a.todos.some(p => !s.todos.includes(p))) fail('auditor todo must equal strategist todo');
  const strat = [...s.plans, ...s.todos];
  if (new Set(strat.map(fold)).size !== strat.length) fail('duplicate strategist pattern');
  if (d.docs.some(p => strat.some(q => fold(p) === fold(q))) || c.generated.some(p => [...strat, ...a.todos, ...d.docs].some(q => obviousOverlap(p, q)))) fail('cross-owner pattern');
  return Object.freeze({ version: 1, roles, protected: list(obj.protected, 'protected'), approvalLinePrefixes: list(obj.approvalLinePrefixes, 'approval prefixes', false) });
}

export function loadOwnership({ projectRoot, globalPath } = {}) {
  const result = (source, policy, reason) => Object.freeze({ source, policy, reason });
  if (unsafeLexical(projectRoot) || unsafeLexical(globalPath)) return result('none', null, 'invalid paths');
  const override = path.join(projectRoot, 'role-ownership.json');
  let present;
  try { fs.lstatSync(override); present = true; } catch (e) { if (e.code !== 'ENOENT') return result('none', null, 'override inaccessible'); present = false; }
  try {
    const selected = present ? override : globalPath;
    return result(present ? 'project' : 'global', validateOwnershipPolicy(JSON.parse(fs.readFileSync(selected, 'utf8'))), 'valid policy');
  } catch { return result('none', null, present ? 'invalid project override' : 'invalid or missing global policy'); }
}

function unsafeLexical(p) {
  if (typeof p !== 'string' || !p || p.includes('\0') || /^[\\/]{2}/.test(p)) return true;
  const normalized = p.replace(/\\/g, '/');
  if (/^[a-z]:(?!\/)/i.test(normalized)) return true;
  const rest = normalized.replace(/^[a-z]:/i, '');
  if (rest.includes(':')) return true;
  return rest.split('/').some(s => s === '..' || /[. ]$/.test(s) || /~\d/i.test(s) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(s));
}
function inside(root, target) {
  const relative = path.relative(root, target);
  return !!relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
function canonicalTarget(projectRoot, requestedPath) {
  // Do not perform any filesystem operation until all user-controlled path strings pass lexical checks.
  if (unsafeLexical(projectRoot) || unsafeLexical(requestedPath)) throw new Error('unsafe lexical path');
  const root = fs.realpathSync.native(projectRoot);
  const target = path.resolve(projectRoot, requestedPath);
  if (!inside(root, target)) throw new Error('outside project root');
  let current = root, exists = false;
  const segments = path.relative(root, target).split(path.sep);
  let missing = false;
  for (let i = 0; i < segments.length; i++) {
    current = path.join(current, segments[i]);
    if (missing) continue;
    let st;
    try { st = fs.lstatSync(current); } catch (e) { if (e.code === 'ENOENT') { missing = true; continue; } throw e; }
    if (st.isSymbolicLink() || fs.realpathSync.native(current) !== current) throw new Error('path alias');
    if (i < segments.length - 1) { if (!st.isDirectory()) throw new Error('invalid ancestor'); }
    else { if (!st.isFile() || st.nlink !== 1) throw new Error('invalid target'); exists = true; }
  }
  return { target, relative: path.relative(root, target).split(path.sep).join('/'), exists };
}
export function authorizeMutation({ ownership, role, projectRoot, requestedPath, operation, globalPath } = {}) {
  let relPath = null, canonicalPath = null, ownerClass = null;
  const result = (allow, reason) => Object.freeze({ allow, reason, relPath, canonicalPath, ownerClass });
  try {
    if (unsafeLexical(globalPath)) return result(false, 'invalid global path');
    const target = canonicalTarget(projectRoot, requestedPath);
    relPath = target.relative; canonicalPath = target.target;
    if (!['strategist', 'coder', 'auditor', 'scribe'].includes(role) || !['edit', 'write'].includes(operation)) return result(false, 'invalid role or operation');
    if (!ownership || !['project', 'global'].includes(ownership.source)) return result(false, 'no ownership');
    const policy = validateOwnershipPolicy(ownership.policy);
    let global = path.resolve(globalPath);
    try { global = fs.realpathSync.native(global); } catch (e) { if (e.code !== 'ENOENT') return result(false, 'invalid global path'); }
    if (fold(canonicalPath) === fold(global)) return result(false, 'global ownership protected');
    const evidence = match('Artifacts/Evidence/**', relPath);
    if (PROTECTED_FLOOR.slice(1).some(p => match(p, relPath)) || policy.protected.some(p => match(p, relPath))) return result(false, 'protected');
    if (evidence) { ownerClass = 'evidence'; return result(role === 'coder' && operation === 'write' && !target.exists, 'evidence create-only'); }
    const r = policy.roles;
    const strategist = [...r.strategist.plans, ...r.strategist.todos].some(p => match(p, relPath));
    const auditor = r.auditor.todos.some(p => match(p, relPath));
    const scribe = r.scribe.docs.some(p => match(p, relPath));
    const generated = r.coder.generated.some(p => match(p, relPath));
    if ((scribe && (strategist || auditor || generated)) || (generated && (strategist || auditor))) return result(false, 'ambiguous ownership');
    ownerClass = scribe ? 'scribe' : strategist ? 'strategist' : generated ? 'generated' : 'residual';
    const allow = role === 'strategist' ? strategist : role === 'auditor' ? auditor && operation === 'edit' : role === 'scribe' ? scribe : !strategist && !auditor && !scribe;
    return result(allow, allow ? 'owned' : 'not owned');
  } catch (e) { return result(false, `refused: ${e.message}`); }
}
