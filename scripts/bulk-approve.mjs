import { readFileSync, mkdirSync, lstatSync, writeFileSync, renameSync, unlinkSync, realpathSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRolePolicy } from '../pi/lib/role-policy.mjs';
import { inspectFiles, validateApprovalRecord, validateAdmission } from '../pi/lib/bulk-admission.mjs';

const options = new Set(['root', 'policy', 'worker', 'input-rate', 'output-rate', 'max-output-tokens', 'max-cost-usd', 'max-total-usd', 'ttl-hours', 'system-prompt']);
function main(argv) {
  const values = {}, paths = []; let replace = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--replace') { if (replace) throw new Error('duplicate --replace'); replace = true; continue; }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (!options.has(key) || Object.hasOwn(values, key) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`invalid option: ${arg}`);
      values[key] = argv[++i];
    } else paths.push(arg);
  }
  for (const key of options) if (key !== 'policy' && !values[key]) throw new Error(`missing --${key}`);
  const number = key => { const s = values[key]; if (!s.trim() || !Number.isFinite(Number(s))) throw new Error(`invalid --${key}`); return Number(s); };
  const ttl = number('ttl-hours'); if (ttl <= 0 || ttl > 24) throw new Error('invalid --ttl-hours');
  const policy = loadRolePolicy(values.policy || process.env.PI_ROLE_POLICY_PATH || path.join(homedir(), '.pi', 'agent', 'role-policy.json'));
  const now = new Date();
  const inspected = inspectFiles({ root: values.root, paths }); if (!inspected.ok) throw new Error(inspected.reason);
  const approval = {
    version: 1, approvalId: randomUUID(), approvedAt: now.toISOString(), expiresAt: new Date(now.getTime() + ttl * 3600000).toISOString(),
    worker: values.worker, rates: { inputPerMTok: number('input-rate'), outputPerMTok: number('output-rate') },
    maxOutputTokens: number('max-output-tokens'), maxCostUsd: number('max-cost-usd'), maxTotalUsd: number('max-total-usd'),
    systemPromptSha256: createHash('sha256').update(readFileSync(values['system-prompt'])).digest('hex'),
    approvedPaths: paths, approvedSha256: Object.fromEntries(inspected.files.map(f => [f.path, f.sha256])),
  };
  const valid = validateApprovalRecord(approval, { policy, now }); if (!valid.ok) throw new Error(valid.reason);
  const admitted = validateAdmission({ root: values.root, paths, approval, policy, now }); if (!admitted.ok) throw new Error(admitted.reason);
  const root = realpathSync(values.root); let directory = root;
  for (const part of ['Artifacts', '.agent']) {
    directory = path.join(directory, part);
    try { mkdirSync(directory); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const stat = lstatSync(directory); if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('unsafe approval directory');
  }
  const target = path.join(directory, 'bulk-read-approval.json'); const content = JSON.stringify(approval, null, 2) + '\n';
  if (!replace) writeFileSync(target, content, { flag: 'wx', mode: 0o600 });
  else {
    const temp = path.join(directory, `.bulk-approval-${randomUUID()}.tmp`);
    try { writeFileSync(temp, content, { flag: 'wx', mode: 0o600 }); renameSync(temp, target); }
    finally { try { unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  }
  console.log(`Approval written: ${target}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(`Approval refused: ${error.message}`); process.exitCode = 1; }
}
