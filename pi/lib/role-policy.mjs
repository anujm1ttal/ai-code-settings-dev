import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THINKING_LEVELS = new Set(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
const TOOL_NAMES = new Set(['read', 'grep', 'find', 'ls', 'bash', 'edit', 'write', 'powershell']);
const WRITE_OR_SHELL = new Set(['bash', 'powershell', 'edit', 'write']);
const READ_ONLY_ROLES = new Set(['auditor', 'scribe', 'explorer']);
const EXPLORER_TOOLS = ['read', 'grep', 'find', 'ls'];
const EXPLORER_TOOL_SET = new Set(EXPLORER_TOOLS);

function hasExactExplorerTools(tools) {
  return Array.isArray(tools) && tools.length === EXPLORER_TOOLS.length &&
    new Set(tools).size === EXPLORER_TOOLS.length && tools.every((tool) => EXPLORER_TOOL_SET.has(tool));
}
const GUARD_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../extensions/guard.ts');

export function loadRolePolicy(file) {
  const policy = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(policy.allowedModels) || policy.allowedModels.length !== 5 ||
      new Set(policy.allowedModels).size !== 5 ||
      !policy.allowedModels.every((model) => typeof model === 'string' && model.includes('/')) ||
      !policy.roles || typeof policy.roles !== 'object') {
    throw new Error('Invalid Pi pilot role policy or explicit model allowlist');
  }
  const roleKeys = Object.keys(policy.roles).sort();
  if (![
    ['auditor', 'coder', 'strategist'],
    ['auditor', 'coder', 'scribe', 'strategist'],
    ['auditor', 'coder', 'explorer', 'strategist'],
    ['auditor', 'coder', 'explorer', 'scribe', 'strategist'],
  ].some((keys) => keys.length === roleKeys.length && keys.every((key, index) => key === roleKeys[index]))) {
    throw new Error('Invalid Pi pilot role keys: migrate concierge to explorer; unknown roles are not allowed');
  }
  for (const [name, role] of Object.entries(policy.roles)) {
    if (!policy.allowedModels.includes(role.model) || !THINKING_LEVELS.has(role.thinking) ||
        !Array.isArray(role.tools) || role.tools.length === 0 ||
        !role.tools.every((tool) => TOOL_NAMES.has(tool)) ||
        (READ_ONLY_ROLES.has(name) && role.tools.some((tool) => WRITE_OR_SHELL.has(tool))) ||
        (name === 'explorer' && !hasExactExplorerTools(role.tools))) {
      throw new Error(`Invalid role configuration for ${name}`);
    }
  }
  return policy;
}

export function buildAgentArgs(policy, roleName, promptPath, task, { profile } = {}) {
  if (roleName === 'concierge') throw new Error('Migrate concierge to explorer');
  const role = policy.roles[roleName];
  if (!role) throw new Error(`Unknown role: ${roleName}`);
  if (!policy.allowedModels.includes(role.model)) {
    throw new Error(`Role ${roleName} model is not in the explicit model allowlist: ${role.model}`);
  }
  if (roleName === 'explorer' && !hasExactExplorerTools(role.tools)) {
    throw new Error('Explorer tools must be read,grep,find,ls only');
  }
  if (READ_ONLY_ROLES.has(roleName) && role.tools.some((tool) => WRITE_OR_SHELL.has(tool))) {
    throw new Error(`${roleName[0].toUpperCase()}${roleName.slice(1)} tools may not include shell or write-capable tools`);
  }
  if (profile !== undefined && (profile !== 'council-read-only' ||
      !['strategist', 'coder', 'auditor'].includes(roleName))) {
    throw new Error('Invalid council read-only profile or viewpoint');
  }
  if (!task || typeof task !== 'string') throw new Error('A nonempty task is required');
  const tools = profile === 'council-read-only' || roleName === 'explorer' ? EXPLORER_TOOLS : role.tools;
  return [
    '--mode', 'json', '--print', '--no-session', '--no-extensions',
    ...(tools.some((tool) => WRITE_OR_SHELL.has(tool)) ? ['--extension', GUARD_PATH] : []),
    '--model', role.model, '--thinking', role.thinking,
    '--tools', tools.join(','), '--exclude-tools', 'mcp__*',
    '--append-system-prompt', promptPath, `Task: ${task}`,
  ];
}
