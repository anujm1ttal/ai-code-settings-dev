import { readFileSync } from 'node:fs';

const THINKING_LEVELS = new Set(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
const TOOL_NAMES = new Set(['read', 'grep', 'find', 'ls', 'bash', 'edit', 'write', 'powershell']);

export function loadRolePolicy(file) {
  const policy = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(policy.allowedModels) || policy.allowedModels.length !== 5 ||
      new Set(policy.allowedModels).size !== 5 ||
      !policy.allowedModels.every((model) => typeof model === 'string' && model.includes('/')) ||
      !policy.roles || typeof policy.roles !== 'object' ||
      Object.keys(policy.roles).sort().join(',') !== 'auditor,coder,strategist') {
    throw new Error('Invalid Pi pilot role policy or explicit model allowlist');
  }
  for (const [name, role] of Object.entries(policy.roles)) {
    if (!policy.allowedModels.includes(role.model) || !THINKING_LEVELS.has(role.thinking) ||
        !Array.isArray(role.tools) || role.tools.length === 0 ||
        !role.tools.every((tool) => TOOL_NAMES.has(tool)) ||
        (name === 'auditor' && role.tools.some((tool) => ['bash', 'powershell', 'edit', 'write'].includes(tool)))) {
      throw new Error(`Invalid role configuration for ${name}`);
    }
  }
  return policy;
}

export function buildAgentArgs(policy, roleName, promptPath, task) {
  const role = policy.roles[roleName];
  if (!role) throw new Error(`Unknown role: ${roleName}`);
  if (!policy.allowedModels.includes(role.model)) {
    throw new Error(`Role ${roleName} model is not in the explicit model allowlist: ${role.model}`);
  }
  if (roleName === 'auditor' && role.tools.some((tool) => ['bash', 'powershell', 'edit', 'write'].includes(tool))) {
    throw new Error('Auditor tools may not include shell or write-capable tools');
  }
  if (!task || typeof task !== 'string') throw new Error('A nonempty task is required');
  return [
    '--mode', 'json', '--print', '--no-session', '--no-extensions',
    '--model', role.model, '--thinking', role.thinking,
    '--tools', role.tools.join(','), '--exclude-tools', 'mcp__*',
    '--append-system-prompt', promptPath, `Task: ${task}`,
  ];
}
