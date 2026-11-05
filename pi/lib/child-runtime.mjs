// Scoped overrides never persist settings. Pi's own main() may perform pre-existing startup
// migrations/cleanup that write settings, keybindings and auth files (migrations.js:54,151),
// just like the ordinary CLI. Real probes require a disposable PI_CODING_AGENT_DIR or pre/post
// hashes; the pre-main effective-runtime check does not prove main's filesystem behavior.
// Bun/SEA parents, where process.execPath is the Pi executable rather than Node, are unsupported.
// The fake transient/overflow controls prove getter patching, not Pi recovery behavior; source
// reading: agent-session.js:3091-3094,2392-2394; sdk.js:202; provider-retry.js:77.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageName = '@earendil-works/pi-coding-agent';
const rawStdoutWrite = process.stdout.write.bind(process.stdout);

function installGuardBarrier(sdk) {
  const toolsIndex = process.argv.indexOf('--tools');
  const tools = new Set(toolsIndex < 0 ? [] : (process.argv[toolsIndex + 1] || '').split(','));
  if (!tools.has('edit') && !tools.has('write')) return;
  const role = process.env.PI_ROLE, nonce = process.env.PI_ROLE_GUARD_NONCE;
  if (!['coder', 'strategist', 'scribe'].includes(role) || !nonce) throw new Error('Guard proof missing role or nonce');
  const Loader = sdk.DefaultResourceLoader;
  if (typeof Loader?.prototype?.reload !== 'function' || typeof Loader.prototype.getExtensions !== 'function') {
    throw new Error('Guard proof loader unavailable');
  }
  const expected = path.resolve(fileURLToPath(new URL('../extensions/role-guard.ts', import.meta.url)));
  const original = Loader.prototype.reload;
  let emitted = false;
  Loader.prototype.reload = async function (...args) {
    const result = await original.apply(this, args);
    const loaded = this.getExtensions();
    if (!loaded || !Array.isArray(loaded.extensions) || !Array.isArray(loaded.errors)) throw new Error('Guard proof invalid loader result');
    if (loaded.errors.length) throw new Error(`Guard proof load error: ${String(loaded.errors[0]?.error ?? loaded.errors[0]?.message ?? 'unknown').slice(0, 300)}`);
    const guards = loaded.extensions.filter(ext => typeof ext.resolvedPath === 'string' && path.resolve(ext.resolvedPath) === expected);
    if (guards.length !== 1) throw new Error('Guard proof expected extension missing or duplicated');
    const guard = guards[0];
    for (const name of ['edit', 'write']) {
      const selected = guard.tools?.get(name)?.definition;
      const tag = selected?.[Symbol.for('pi.role.guard.v1')];
      if (selected?.name !== name || tag?.version !== 1 || tag.role !== role || tag.nonce !== nonce || tag.guarded !== true) {
        throw new Error(`Guard proof invalid ${name} definition`);
      }
      if (loaded.extensions.some(ext => ext !== guard && ext.tools?.has(name))) throw new Error(`Guard proof ${name} collision`);
    }
    if (!emitted) {
      await new Promise((resolve, reject) => rawStdoutWrite(JSON.stringify({ type: 'pi_role_guard_ready', version: 1,
        role, nonce, tools: ['edit', 'write'] }) + '\n', error => error ? reject(error) : resolve()));
      emitted = true;
    }
    return result;
  };
}

function modulePath() {
  if (process.env.PI_CHILD_RUNTIME_MODULE) {
    if (!path.isAbsolute(process.env.PI_CHILD_RUNTIME_MODULE)) throw new Error('PI_CHILD_RUNTIME_MODULE must be absolute');
    return process.env.PI_CHILD_RUNTIME_MODULE;
  }
  const managed = process.env.PI_MANAGED_INSTALL_ROOT;
  if (managed) {
    const version = readFileSync(path.join(managed, 'current-version'), 'utf8').trim();
    if (!version || version === '.' || version === '..' || !/^[0-9A-Za-z._+-]+$/.test(version)) {
      throw new Error('Invalid managed Pi version');
    }
    return path.join(managed, 'releases', version, 'node_modules', ...packageName.split('/'), 'dist', 'index.js');
  }
  return createRequire(import.meta.url).resolve(packageName);
}

async function launch() {
  const entry = modulePath();
  const sdk = await import(pathToFileURL(entry).href);
  const Manager = sdk.SettingsManager;
  if (typeof sdk.main !== 'function' || typeof Manager !== 'function' || typeof Manager.inMemory !== 'function') {
    throw new Error('Pi SDK main or SettingsManager.inMemory missing');
  }
  const prototype = Manager.prototype;
  const names = ['getRetrySettings', 'getProviderRetrySettings', 'getRetryEnabled',
    'getCompactionEnabled', 'getCompactionSettings'];
  for (const name of names) if (typeof prototype[name] !== 'function') throw new Error(`Pi SDK missing ${name}`);
  for (const name of ['getRetrySettings', 'getProviderRetrySettings', 'getCompactionSettings']) {
    const original = prototype[name];
    prototype[name] = function (...args) {
      const settings = original.apply(this, args);
      if (!settings || typeof settings !== 'object') throw new Error(`Invalid Pi ${name} result`);
      if (name === 'getRetrySettings') return { ...settings, enabled: false, maxRetries: 0 };
      if (name === 'getProviderRetrySettings') return { ...settings, maxRetries: 0 };
      return { ...settings, enabled: false };
    };
  }
  prototype.getRetryEnabled = () => false;
  prototype.getCompactionEnabled = () => false;
  const settings = Manager.inMemory({ retry: { enabled: true, maxRetries: 9, provider: { maxRetries: 9 } },
    compaction: { enabled: true } });
  const retry = settings.getRetrySettings();
  const effective = { retryEnabled: settings.getRetryEnabled(), retryMaxRetries: retry.maxRetries,
    providerMaxRetries: settings.getProviderRetrySettings().maxRetries,
    compactionEnabled: settings.getCompactionEnabled() };
  if (effective.retryEnabled !== false || retry.enabled !== false || effective.retryMaxRetries !== 0 ||
      effective.providerMaxRetries !== 0 || effective.compactionEnabled !== false ||
      settings.getCompactionSettings().enabled !== false) throw new Error('Pi runtime overrides could not be verified');
  if (process.argv.length === 3 && process.argv[2] === '--print-effective-runtime') {
    console.log(JSON.stringify(effective));
    return;
  }
  installGuardBarrier(sdk);
  // Real Pi's CLI calls setupCli before main; keep its proxy/HTTP and process initialization.
  if (!process.env.PI_CHILD_RUNTIME_MODULE ||
      (path.basename(entry) === 'index.js' && path.basename(path.dirname(entry)) === 'dist')) {
    const setup = await import(pathToFileURL(path.join(path.dirname(entry), 'cli', 'setup.js')).href);
    if (typeof setup.setupCli !== 'function') throw new Error('Pi SDK setupCli missing');
    setup.setupCli();
  }
  console.log(JSON.stringify({ type: 'pi_child_runtime', ...effective }));
  await sdk.main(process.argv.slice(2));
}

launch().catch(error => { console.error(`Pi child runtime unavailable: ${error.message}`); process.exitCode = 1; });
