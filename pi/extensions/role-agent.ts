import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Type } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { loadRolePolicy } from '../lib/role-policy.mjs';
import { runRole } from '../lib/role-runner.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = process.env.PI_ROLE_POLICY_PATH;
if (!policyPath || !path.isAbsolute(policyPath)) {
  throw new Error('PI_ROLE_POLICY_PATH must point to an absolute private role-policy JSON file');
}
const policy = loadRolePolicy(policyPath);

function invocation() {
  const script = process.argv[1];
  if (script && !script.startsWith('/$bunfs/') && existsSync(script)) {
    return { command: process.execPath, args: [script] };
  }
  return { command: 'pi', args: [] };
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand('pi-roles', {
    description: 'Show the three pilot roles, models, thinking levels, and tool lists',
    handler: async (_args, ctx) => {
      const summary = Object.entries(policy.roles).map(([name, role]) =>
        `${name}: ${role.model} (${role.thinking}); tools: ${role.tools.join(', ')}`).join('\n');
      if (ctx.hasUI) ctx.ui.notify(summary, 'info');
    },
  });

  pi.registerTool({
    name: 'pi_role_agent',
    label: 'Pi role agent',
    description: 'Delegate a bounded task to an isolated strategist, coder, or report-only auditor. ' +
      'The role policy selects one explicitly configured model and thinking level; inspect the returned evidence.',
    parameters: Type.Object({
      role: Type.Union([Type.Literal('strategist'), Type.Literal('coder'), Type.Literal('auditor')]),
      task: Type.String({ minLength: 1, description: 'Specific bounded task and expected output' }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const promptPath = path.join(sourceRoot, 'agents', `${params.role}.md`);
      const result = await runRole(policy, params.role, params.task, ctx.cwd, promptPath,
        { signal, invocation: invocation() });
      return {
        content: [{ type: 'text', text: `${result.role} (${result.model}, ${result.thinking})\n\n${result.text}` }],
        details: { role: result.role, model: result.model, thinking: result.thinking },
        usage: result.usage,
      };
    },
  });
}
