import { readFileSync } from 'node:fs';
import { validateRate } from './pricing.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const THINKING_LEVELS = new Set(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
const WRITE_OR_SHELL = new Set(['bash', 'edit', 'write']);
const EXPLORER_TOOLS = ['read', 'grep', 'find', 'ls'];
const EXPLORER_TOOL_SET = new Set(EXPLORER_TOOLS);
const ROLE_MAXIMA = Object.freeze({
  explorer: EXPLORER_TOOLS,
  strategist: [...EXPLORER_TOOLS, 'edit', 'write'],
  coder: [...EXPLORER_TOOLS, 'bash', 'edit', 'write'],
  auditor: EXPLORER_TOOLS,
  scribe: [...EXPLORER_TOOLS, 'edit', 'write'],
});

function validRoleTools(name, tools) {
  const maximum = ROLE_MAXIMA[name];
  return Boolean(maximum) && Array.isArray(tools) && tools.length > 0 &&
    new Set(tools).size === tools.length && tools.every(tool => maximum.includes(tool)) &&
    (name !== 'explorer' || hasExactExplorerTools(tools));
}

function hasExactExplorerTools(tools) {
  return Array.isArray(tools) && tools.length === EXPLORER_TOOLS.length &&
    new Set(tools).size === EXPLORER_TOOLS.length && tools.every((tool) => EXPLORER_TOOL_SET.has(tool));
}
const GUARD_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../extensions/guard.ts');
const ROLE_GUARD_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../extensions/role-guard.ts');
const RECORDER_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../extensions/auditor-recorder.ts');

export function loadRolePolicy(file) {
  const policy = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(policy.allowedModels) || policy.allowedModels.length !== 5 ||
      new Set(policy.allowedModels).size !== 5 ||
      !policy.allowedModels.every((model) => typeof model === 'string' && model.includes('/')) ||
      !policy.roles || typeof policy.roles !== 'object') {
    throw new Error('Invalid Pi pilot role policy or explicit model allowlist');
  }
  if (Object.hasOwn(policy, 'jobBudget')) {
    const budget = policy.jobBudget;
    const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
    const finite = (value) => typeof value === 'number' && Number.isFinite(value);
    if (!object(budget) || !finite(budget.perJobUsd) || budget.perJobUsd <= 0 || budget.perJobUsd > 10 ||
        !finite(budget.perSessionUsd) || budget.perSessionUsd < budget.perJobUsd || budget.perSessionUsd > 50 ||
        !object(budget.rates) || !Object.entries(budget.rates).every(([model, rate]) =>
          policy.allowedModels.includes(model) && validateRate(rate) &&
          (Object.hasOwn(rate, 'tiers') ? rate.tiers : [rate]).every((tier) =>
            tier.inputPerMTok > 0 && tier.outputPerMTok > 0))) {
      throw new Error('Invalid jobBudget');
    }
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
        !validRoleTools(name, role.tools)) {
      throw new Error(`Invalid role configuration for ${name}`);
    }
  }
  return policy;
}

export function buildAgentArgs(policy, roleName, promptPath, task, { profile, promptFile } = {}) {
  if (roleName === 'concierge') throw new Error('Migrate concierge to explorer');
  const role = policy.roles[roleName];
  if (!role) throw new Error(`Unknown role: ${roleName}`);
  if (!policy.allowedModels.includes(role.model)) {
    throw new Error(`Role ${roleName} model is not in the explicit model allowlist: ${role.model}`);
  }
  if (!validRoleTools(roleName, role.tools)) {
    throw new Error(`${roleName[0].toUpperCase()}${roleName.slice(1)} tools violate role maximum`);
  }
  if (profile !== undefined && !(
    (profile === 'record' && roleName === 'auditor') ||
    (profile === 'read-only' && ['strategist', 'coder', 'auditor', 'scribe'].includes(roleName)) ||
    (profile === 'council-read-only' && ['strategist', 'coder', 'auditor'].includes(roleName)) ||
    (profile === 'packet-only-review' && ['strategist', 'coder', 'auditor', 'explorer'].includes(roleName))
  )) throw new Error('Invalid council or read-only profile or viewpoint');
  if (!task || typeof task !== 'string') throw new Error('A nonempty task is required');
  if (promptFile !== undefined && (profile !== 'packet-only-review' || roleName !== 'explorer' || typeof promptFile !== 'string' || !path.isAbsolute(promptFile))) {
    throw new Error('Prompt file requires an absolute path and packet-only explorer');
  }
  if (profile === 'packet-only-review') return [
    '--mode', 'json', '--print', '--no-session', '--no-extensions', '--no-tools',
    '--no-context-files', '--no-skills', '--no-prompt-templates', '--no-mcp',
    '--model', role.model, '--thinking', role.thinking, '--exclude-tools', 'mcp__*',
    '--system-prompt', promptPath, ...(promptFile === undefined ? [] : [`@${promptFile}`]), `Task: ${task}`, // replaces Pi's default prompt (tool, rules and docs sections); only a cwd line is added by Pi
  ];
  const tools = profile === 'record' ? [...EXPLORER_TOOLS, 'pi_record_verification'] :
    profile === 'council-read-only' || profile === 'read-only' || roleName === 'explorer' ? EXPLORER_TOOLS : role.tools;
  return [
    '--mode', 'json', '--print', '--no-session', '--no-extensions',
    ...(roleName === 'explorer' ? ['--no-mcp'] : []),
    ...(profile === 'record' ? ['--extension', RECORDER_PATH] : []),
    ...(tools.some(tool => tool === 'edit' || tool === 'write') ? ['--extension', ROLE_GUARD_PATH] : []),
    ...(tools.some((tool) => WRITE_OR_SHELL.has(tool)) ? ['--extension', GUARD_PATH] : []),
    '--model', role.model, '--thinking', role.thinking,
    '--tools', tools.join(','), '--exclude-tools', 'mcp__*',
    '--append-system-prompt', promptPath, `Task: ${task}`,
  ];
}
