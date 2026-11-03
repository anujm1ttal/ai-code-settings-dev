import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { runRole } from './role-runner.mjs';

export async function runBulkWorker({ model, system, prompt, maxOutputTokens, signal, timeoutMs }, { policy, root, spawnImpl, invocation } = {}) {
  let scratch;
  try {
    if (model !== policy?.roles?.explorer?.model || typeof system !== 'string' || typeof prompt !== 'string' ||
        !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens <= 0) throw new Error('Invalid bulk worker request');
    const parent = path.join(path.resolve(root), 'Artifacts', 'Temp');
    fs.mkdirSync(parent, { recursive: true });
    scratch = path.join(parent, `bulk-read-${randomUUID()}`);
    fs.mkdirSync(scratch, { mode: 0o700 });
    const promptFile = path.join(scratch, 'prompt.txt'); const systemFile = path.join(scratch, 'system.txt');
    fs.writeFileSync(promptFile, prompt, { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(systemFile, system, { flag: 'wx', mode: 0o600 });
    const result = await runRole(policy, 'explorer', 'Answer the question using the supplied data.', root, systemFile,
      { profile: 'packet-only-review', promptFile, signal, timeoutMs, spawnImpl, invocation,
        resultStore: { dir: scratch, dispatchId: randomUUID() } });
    return { ok: true, text: result.text, usage: result.usage, error: null };
  } catch (error) {
    return { ok: false, text: typeof error?.partialText === 'string' ? error.partialText : '', usage: error?.usage ?? null,
      error: String(error?.message ?? 'bulk worker failed') };
  } finally {
    if (scratch) { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* cleanup must not mask the result */ } }
  }
}
