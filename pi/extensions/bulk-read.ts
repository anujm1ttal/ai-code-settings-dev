import fs from 'node:fs';
import path from 'node:path';
import { Type } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { loadRolePolicy } from '../lib/role-policy.mjs';
import { validateApprovalRecord } from '../lib/bulk-admission.mjs';
import { bulkRead } from '../lib/bulk-read.mjs';
import { runBulkWorker } from '../lib/bulk-worker.mjs';

const policyPath = process.env.PI_ROLE_POLICY_PATH;
if (!policyPath || !path.isAbsolute(policyPath)) throw new Error('PI_ROLE_POLICY_PATH must point to an absolute private role-policy JSON file');
const policy = loadRolePolicy(policyPath);

export default function (pi: ExtensionAPI) {
  let registered;
  pi.on('session_start', (_event, ctx) => {
    let approval;
    try {
      approval = JSON.parse(fs.readFileSync(path.join(ctx.cwd, 'Artifacts', '.agent', 'bulk-read-approval.json'), 'utf8'));
      if (!validateApprovalRecord(approval, { policy, now: new Date() }).ok) approval = undefined;
    } catch { approval = undefined; }
    if (!approval) {
      if (registered) pi.registerTool({ ...registered, exposure: 'hidden' });
      return;
    }
    const root = ctx.cwd;
    registered = {
      name: 'pi_bulk_read', label: 'Bulk read', description: 'Read the approved files once and return cited untrusted evidence.',
      parameters: Type.Object({ paths: Type.Array(Type.String()), question: Type.String() }),
      async execute(_id, params, _signal, _update, toolCtx) {
        if (path.resolve(toolCtx.cwd) !== path.resolve(root)) throw new Error('Bulk-read session root changed');
        const result = await bulkRead({ root, paths: params.paths, question: params.question, approval, policy,
          runWorker: args => runBulkWorker(args, { policy, root }) });
        return { content: [{ type: 'text', text: result.envelope }], details: undefined };
      },
    };
    pi.registerTool(registered);
  });
}
