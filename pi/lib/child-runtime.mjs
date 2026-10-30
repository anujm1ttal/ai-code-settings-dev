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
import { pathToFileURL } from 'node:url';

const packageName = '@earendil-works/pi-coding-agent';

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
