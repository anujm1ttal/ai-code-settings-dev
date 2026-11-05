import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// Child-only extension. Missing dependencies must still replace both native tools.
export default async function register(pi: ExtensionAPI) {
  const role = process.env.PI_ROLE;
  const globalPath = path.join(process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent'), 'role-ownership.json');
  let definitions: any[];
  let healthy = false;
  try {
    const sdkPath = process.env.PI_CODING_AGENT_SDK_PATH;
    if (sdkPath && !path.isAbsolute(sdkPath)) throw new Error('SDK path must be absolute');
    const sdk = sdkPath ? await import(pathToFileURL(sdkPath).href) : await import('@earendil-works/pi-coding-agent');
    const core = await import('../lib/role-guard-core.mjs');
    const factories = { edit: sdk.createEditToolDefinition, write: sdk.createWriteToolDefinition };
    if (typeof factories.edit !== 'function' || typeof factories.write !== 'function' || typeof core.createGuardedOperations !== 'function') throw new Error('missing guard dependency');
    definitions = (['edit', 'write'] as const).map(kind => {
      const prototype = factories[kind](process.cwd());
      return { ...prototype, async execute(id: string, input: any, signal: any, update: any, ctx: any) {
        const cwd = ctx?.cwd;
        if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) throw new Error('Mutation refused: missing project directory');
        const ops = core.createGuardedOperations({ role, projectRoot: cwd, globalPath });
        ops.authorize(input?.path, kind);
        return factories[kind](cwd, { operations: ops[kind] }).execute(id, input, signal, update, ctx);
      } };
    });
    healthy = true;
  } catch {
    definitions = (['edit', 'write'] as const).map(name => ({
      name, label: name, description: 'Unavailable: mutation guard dependency failed to load.',
      parameters: { type: 'object', properties: {}, additionalProperties: true },
      async execute() { throw new Error('Mutation refused: guard dependency unavailable'); },
    }));
  }
  for (const definition of definitions) pi.registerTool(definition);
  if (healthy) {
    const tag = Object.freeze({ version: 1, role, nonce: process.env.PI_ROLE_GUARD_NONCE, guarded: true });
    for (const definition of definitions) definition[Symbol.for('pi.role.guard.v1')] = tag;
  }
}
