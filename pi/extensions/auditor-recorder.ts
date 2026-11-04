import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// Child-only: the parent provides the complete binding, never the model.
export default async function register(pi: ExtensionAPI, hooks: { queue?: any, afterInitialize?: () => void } = {}) {
  const role = process.env.PI_ROLE;
  const globalPath = path.join(process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent'), 'role-ownership.json');
  let core: any, binding: any, queue: any, failure: string | undefined;
  try {
    if (role !== 'auditor') throw new Error('auditor role required');
    if (!process.env.PI_RECORD_BINDING) throw new Error('missing binding');
    const sdkPath = process.env.PI_CODING_AGENT_SDK_PATH;
    if (sdkPath && !path.isAbsolute(sdkPath)) throw new Error('SDK path must be absolute');
    const sdk = sdkPath ? await import(pathToFileURL(sdkPath).href) : await import('@earendil-works/pi-coding-agent');
    queue = hooks.queue ?? sdk.withFileMutationQueue;
    core = await import('../lib/auditor-recorder.mjs');
    if (typeof queue !== 'function' || typeof core.validateBinding !== 'function' || typeof core.createRecorder !== 'function') throw new Error('recorder dependency unavailable');
    binding = core.validateBinding(JSON.parse(process.env.PI_RECORD_BINDING));
    hooks.afterInitialize?.();
  } catch (error: any) { failure = error?.message || 'recorder dependency unavailable'; }
  let record: (() => any) | undefined, root: string | undefined;
  pi.registerTool({
    name: 'pi_record_verification', label: 'Record verification',
    description: 'Record the parent-bound settled audit verdict.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    async execute(_id: string, input: any, _signal: any, _update: any, ctx: any) {
      if (failure) throw new Error(`Recording refused: ${failure}`);
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Recording refused: no parameters accepted');
      if (typeof ctx?.cwd !== 'string' || !path.isAbsolute(ctx.cwd)) throw new Error('Recording refused: missing absolute project directory');
      if (root && root !== ctx.cwd) throw new Error('Recording refused: project directory changed');
      try {
        if (!record) { root = ctx.cwd; record = core.createRecorder({ binding, projectRoot: root, globalPath, role }); }
        const result = await queue(path.join(root!, ...binding.todo.split('/')), async () => record!());
        return { content: [{ type: 'text', text: `${result.todo}: ${result.task} ${result.verdict}` }], details: undefined };
      } catch (error: any) { throw new Error(`Recording refused: ${error?.message || 'recorder unavailable'}`); }
    },
  });
}
