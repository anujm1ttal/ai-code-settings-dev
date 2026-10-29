import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { conciergeToolDenial } from '../lib/concierge-guard.mjs';

// Repo layout keeps the shared config under hooks/; the installed layout stages it at pi/license-gate.json because
// Pi 1.4.0 warns (and waits for a key) whenever the agent directory contains a hooks/ folder.
const licenseGateUrl = [new URL('../../hooks/license-gate.json', import.meta.url), new URL('../license-gate.json', import.meta.url)]
  .find(candidate => fs.existsSync(candidate));
if (!licenseGateUrl) throw new Error('Pi guard requires a valid license-gate.json');
const licenseGate = JSON.parse(fs.readFileSync(licenseGateUrl, 'utf8')) as {
  source_roots: string[]; dest_prefixes: string[]; markers: string[]; self_exempt: string[];
};
if (!licenseGate.source_roots?.length || !licenseGate.dest_prefixes?.length ||
    !licenseGate.markers?.length || !licenseGate.self_exempt?.length) {
  throw new Error('Pi guard requires a valid license-gate.json');
}

const BLOCKED_EXTENSIONS = new Set(['.pbix', '.3dm', '.pptx', '.xlsx', '.docx', '.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.7z', '.tmdl']);
const BLOCKED_SEGMENTS = new Set(['secrets', 'credentials', 'private_keys', 'node_modules', 'dist', 'build', '.git']);
const COMPILED_CHILDREN = new Set(['debug', 'release', 'x64', 'x86']);

function pathDenial(raw: unknown, payload: unknown, cwd: string): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return 'Missing target path';
  let requested = raw.replace(/^[\u00a0\u202f]/, ' ').replace(/^@/, '');
  if (requested === '~' || requested.startsWith('~/') || requested.startsWith('~\\')) {
    requested = path.join(os.homedir(), requested.slice(2));
  }
  if (requested.startsWith('file://')) {
    try { requested = fileURLToPath(requested); } catch { return 'Malformed file URL'; }
  }
  const target = path.resolve(cwd, requested);
  const normalized = path.win32.normalize(target.replaceAll('/', '\\')).toLowerCase();
  const parts = normalized.split('\\').filter(Boolean).map(part => part.replace(/[ .]+$/, ''));
  const name = parts.at(-1) ?? '';
  if (name === '.env' || (name.startsWith('.env.') &&
      !['.env.example', '.env.sample', '.env.template'].includes(name))) return 'Secret file';
  if (BLOCKED_EXTENSIONS.has(path.win32.extname(name))) return 'Protected binary or archive';
  if (parts.some(part => BLOCKED_SEGMENTS.has(part))) return 'Protected path segment';
  if (parts.some((part, i) => (part === 'bin' || part === 'obj') && COMPILED_CHILDREN.has(parts[i + 1]))) return 'Compiled output';
  const joined = `/${parts.join('/')}/`;
  if (licenseGate.dest_prefixes.some(prefix => joined.includes(`/${prefix.toLowerCase().replaceAll('\\', '/')}`))) return 'Licensed destination';
  const exempt = licenseGate.self_exempt.some(file => joined.endsWith(`/${file.toLowerCase().replaceAll('\\', '/')}`));
  const normalizedPayload = typeof payload === 'string' ? payload.toLowerCase().replace(/\s+/g, ' ') : '';
  if (!exempt && !fs.existsSync(target) &&
      licenseGate.markers.some(marker => normalizedPayload.includes(marker.toLowerCase().replace(/\s+/g, ' ')))) {
    return 'New file carries a restricted license marker';
  }
  return undefined;
}

// B1: write/edit stay inside the launch directory or the OS temp dir (security.md: write access scoped to the project).
// Pi tool allowlists are not an OS sandbox: shell copies and redirects to non-source paths are not covered here.
function realPathOfExistingAncestor(target: string): string | undefined {
  let current = target;
  const tail: string[] = [];
  for (;;) {
    try {
      const real = fs.realpathSync.native(current);
      return tail.length ? path.join(real, ...tail.reverse()) : real;
    } catch {
      // A dangling link cannot be resolved, so fail closed rather than write through it.
      try { if (fs.lstatSync(current, { throwIfNoEntry: false })) return undefined; } catch { return undefined; }
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      tail.push(path.basename(current));
      current = parent;
    }
  }
}

function isWithin(base: string, target: string): boolean {
  const relative = path.relative(base, target);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

// Mirrors Pi's normalizeWindowsShellPath: /c/x, /mnt/c/x and /cygdrive/c/x mean C:\x on Windows.
function windowsShellPath(filePath: string): string {
  if (process.platform !== 'win32' || !filePath.startsWith('/') || filePath.startsWith('//') || filePath.includes('\\')) return filePath;
  const match = filePath.match(/^\/(?:mnt\/|cygdrive\/)?([a-z])(?:\/(.*))?$/i);
  if (!match) return filePath;
  return `${match[1].toUpperCase()}:\\${(match[2] ?? '').replaceAll('/', '\\')}`;
}

function outsideProjectDenial(raw: unknown, cwd: unknown): string | undefined {
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) return 'Missing project directory';
  if (typeof raw !== 'string') return 'Missing target path';
  // Pi normalizes these Unicode spaces anywhere in a path, so the guard must see the same string.
  let requested = raw.replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ').replace(/^@/, '');
  requested = windowsShellPath(requested);
  if (requested === '~' || requested.startsWith('~/') || requested.startsWith('~\\')) {
    requested = path.join(os.homedir(), requested.slice(2));
  }
  if (requested.startsWith('file://')) {
    try { requested = fileURLToPath(requested); } catch { return 'Malformed file URL'; }
  }
  // Windows trims trailing dots/spaces, so a segment such as ".. " can mean "..".
  if (requested.split(/[\\/]/).some(part => part !== '.' && part !== '..' && part.length > 0 && /^[. ]+$/.test(part))) {
    return 'Ambiguous dot or space path segment';
  }
  let realCwd: string, realTemp: string | undefined;
  try { realCwd = fs.realpathSync.native(cwd); } catch { return 'Unverifiable project directory'; }
  try { realTemp = fs.realpathSync.native(os.tmpdir()); } catch { realTemp = undefined; }
  const resolved = path.resolve(cwd, requested);
  // UNC and extended-length paths are refused before any filesystem call, so the guard never touches a network share.
  if (resolved.startsWith('\\\\')) return 'Network or device path';
  const real = realPathOfExistingAncestor(resolved);
  if (!real) return 'Unresolvable write target';
  if (isWithin(realCwd, real) || (realTemp !== undefined && isWithin(realTemp, real))) return undefined;
  return 'Write target outside the project directory';
}

const DANGEROUS_COMMANDS: [RegExp, string][] = [
  [/\b(?:rd|rmdir|del|erase)\b[^\n]*\/s\b/i, 'Recursive Windows deletion'],
  [/\bRemove-Item\b(?=[^\n]*-Recurse)(?=[^\n]*-Force)/i, 'Recursive PowerShell deletion'],
  [/\b(?:format\s+[a-z]:|Format-Volume\b|Clear-Disk\b|mkfs\.)/i, 'Disk destruction'],
  [/\bgit\s+reset\b[^\n]*--hard\b/i, 'Destructive git reset'],
  [/\bgit\s+clean\s+-[a-z]*f[a-z]*d\b/i, 'Destructive git clean'],
  [/\bgit\s+push\b[^\n]*(?:--force\b(?!-with-lease)|\s-f\b)/i, 'Force push'],
  [/\b(?:DROP\s+(?:TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE|DELETE\s+FROM\s+\S+\s*;?\s*$)/i, 'Destructive SQL'],
  [/\bcurl\b[^\n|]*\|\s*(?:ba)?sh\b/i, 'Remote script piped to shell'],
  [/:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, 'Fork bomb'],
  [/>\s*\/dev\/sd[a-z]/i, 'Direct write to block device'],
  [/\bchmod\s+(-[a-z]+\s+)?777\s+\//i, 'Recursive permission change at root'],
  [/\b(?:iwr|Invoke-WebRequest)\b[^\n|]*\|\s*iex\b/i, 'Remote PowerShell script execution'],
];
const SOURCE_EXTENSIONS = /\.(?:py|pyi|ts|tsx|js|jsx|mjs|cjs|md|json|ya?ml|cs|csproj|dax|sh|ps1)$/i;

function isSourceWriteTarget(raw: string): boolean {
  const target = raw.replaceAll('\\', '/');
  if (!SOURCE_EXTENSIONS.test(target)) return false;
  if (/(?:^|\/)\.\.(?:\/|$)/.test(target)) return true;
  if (/(?:^|\/)Artifacts\/(?:Temp|Evidence)\//i.test(target)) return false;
  if (/^\/tmp\/|^[a-z]:\/tmp\/|^\/dev\/null$/i.test(target)) return false;
  return true;
}

function redirectsToSource(command: string): boolean {
  const stripped = command.replace(/<[a-z0-9_.-]+>/gi, '');
  for (const match of stripped.matchAll(/(?<![-=<>!])\d?>>?\s*['"]?([^\s;'"|&<>()]+)['"]?/g)) {
    if (isSourceWriteTarget(match[1])) return true;
  }
  // Only parse cmdlets at a command/pipeline boundary, not mentions in prose.
  for (const match of stripped.matchAll(/(?:^|[;|]\s*)(?:Out-File|Set-Content|Add-Content)\b([^\n;|]*)/gim)) {
    const args = match[1].trim();
    const named = /-(?:File|Literal)?Path\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))/i.exec(args);
    const positional = args.replace(/-(?:Append|NoNewline|Force)\b/gi, '')
      .replace(/-Encoding\s+\S+/gi, '').trim().match(/^(?:"([^"]+)"|'([^']+)'|([^\s]+))/);
    const target = named ? (named[1] || named[2] || named[3]) : (positional?.[1] || positional?.[2] || positional?.[3]);
    if (target && isSourceWriteTarget(target)) return true;
  }
  return false;
}

function deletesCriticalRoot(command: string): boolean {
  for (const match of command.matchAll(/\brm\s+((?:(?:--[a-z-]+|-[a-z]+)\s+)+)(?:--\s+)?([^\n;|&]+)/gi)) {
    const flags = match[1].match(/--[a-z-]+|-[a-z]+/gi) ?? [];
    if (!flags.some(flag => flag === '--recursive' || (flag.startsWith('-') && !flag.startsWith('--') && flag.slice(1).toLowerCase().includes('r')))) continue;
    const operands = match[2].match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
    for (const operand of operands) {
      const target = operand.replace(/^["']|["']$/g, '').replaceAll('\\', '/');
      const resolved = path.posix.normalize(target.replace(/\/+$/, ''));
      if (target === '/' || target === '/*' || resolved === '.' || resolved === '..' ||
          target === '$HOME' || target === '*' || target.startsWith('~/') || target === '~' ||
          /^[a-z]:\//i.test(target)) return true;
    }
  }
  return false;
}

// S-B: shell copies are not an OS sandbox. This only catches the common cp/mv/install/rsync/ln/tee destination
// operand; interpreters (python -c, node -e), hard links and TOCTOU remain uncovered (see pi/README.md).
const COPY_COMMAND = /(?:^|[;&|(\n]\s*)(?:sudo\s+)?(cp|mv|install|rsync|ln|tee)\b([^\n;&|]*)/gi;

function copyDestinations(command: string, name: string, args: string): string[] {
  const tokens = args.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  const operands: string[] = [];
  let target: string | undefined;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^\d?>/.test(token)) { if (/^\d?>>?$/.test(token)) i++; continue; }
    const unquoted = token.replace(/^["']|["']$/g, '');
    if (token === '-t' || token === '--target-directory') { target = tokens[++i]?.replace(/^["']|["']$/g, ''); continue; }
    if (token.startsWith('--target-directory=')) { target = unquoted.slice('--target-directory='.length); continue; }
    if (token === '--' || /^-[^\s]/.test(token)) continue;
    operands.push(unquoted);
  }
  if (name === 'tee') return operands;
  if (target !== undefined) return [target];
  return operands.length >= 2 ? [operands[operands.length - 1]] : [];
}

function copiesOutsideProject(command: string, cwd: unknown): boolean {
  if (typeof cwd !== 'string') return false;
  for (const match of command.matchAll(COPY_COMMAND)) {
    const name = match[1].toLowerCase();
    for (const destination of copyDestinations(command, name, match[2])) {
      if (!destination || /^\/dev\/(?:null|stdout|stderr)$/.test(destination)) continue;
      if (name === 'rsync' && /^[^/\\:]{2,}:/.test(destination)) return true;
      if (outsideProjectDenial(destination, cwd)) return true;
    }
  }
  return false;
}

function commandDenial(raw: unknown, cwd?: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return 'Missing shell command';
  if (deletesCriticalRoot(raw)) return 'Recursive deletion of a root, home or workspace';
  const normalized = raw.replaceAll('\\', '/').toLowerCase();
  if (licenseGate.source_roots.some(source => normalized.includes(source.toLowerCase().replaceAll('\\', '/')))) return 'Licensed source root';
  const scanned = raw.replace(/\bgit\s+-C\s+(?:"[^"]+"|'[^']+'|\S+)\s+/gi, 'git ');
  const cleanFlags = /\bgit\s+clean\s+((?:(?:-[a-z]+|--force|--dirs)\s*)+)/i.exec(scanned)?.[1] ?? '';
  if ((/(?:--force|-\w*f)/i.test(cleanFlags)) && (/(?:--dirs|-\w*d)/i.test(cleanFlags))) return 'Destructive git clean';
  for (const [pattern, reason] of DANGEROUS_COMMANDS) if (pattern.test(scanned)) return reason;
  if (redirectsToSource(raw)) return 'Shell redirect to source file';
  if (/\bgit\s+commit\b/i.test(raw) && /co-authored-by:\s*claude|generated with[\s\S]*?claude code/i.test(raw)) {
    return 'Commit message contains an AI attribution trailer';
  }
  if (copiesOutsideProject(raw, cwd)) return 'Shell copy writes outside the project directory';
  return undefined;
}

// Explicitly selected by the pilot parent and shell/write-capable role children.
export default function guard(pi: ExtensionAPI) {
  // The concierge runner sets both fields at child launch. A scoped child never falls back to the parent policy.
  const concierge = process.env.PI_ROLE === 'concierge';
  const conciergeRoot = process.env.PI_CONCIERGE_ROOT;
  pi.on('tool_call', async (event, ctx) => {
    if (concierge) {
      let reason = conciergeToolDenial(conciergeRoot, event.toolName, event.input);
      if (!reason && (event.toolName === 'write' || event.toolName === 'edit')) {
        try {
          if (!conciergeRoot || !path.isAbsolute(conciergeRoot) ||
              fs.realpathSync(ctx.cwd) !== fs.realpathSync(conciergeRoot)) reason = 'Concierge cwd differs from fixed root';
        } catch { reason = 'Unverifiable concierge cwd'; }
      }
      if (reason) return { block: true, reason };
    }
    if (event.toolName === 'edit' || event.toolName === 'write') {
      if (typeof ctx.cwd !== 'string') return { block: true, reason: 'Missing project directory' };
      const reason = outsideProjectDenial(event.input.path, ctx.cwd) ??
        pathDenial(event.input.path, event.toolName === 'write' ? event.input.content : undefined, ctx.cwd);
      return reason ? { block: true, reason } : undefined;
    }
    if (event.toolName === 'bash' || event.toolName === 'powershell') {
      const reason = commandDenial(event.input.command, ctx.cwd);
      return reason ? { block: true, reason } : undefined;
    }
    return undefined;
  });
  pi.on('user_bash', async (event, ctx) => {
    if (concierge) return { result: { output: 'Blocked: concierge has no shell', exitCode: 1,
      cancelled: false, truncated: false } };
    const reason = commandDenial(event.command, ctx.cwd);
    if (!reason) return undefined;
    if (ctx.hasUI && await ctx.ui.confirm('Dangerous direct-shell command', `${reason}: ${event.command}\nAllow this command?`, { timeout: 10000 })) {
      return undefined;
    }
    return { result: { output: `Blocked by Pi command guard: ${reason}`, exitCode: 1,
      cancelled: false, truncated: false } };
  });
}
