import fs from 'node:fs';
import path from 'node:path';

const WRITABLE = new Set(['Artifacts/.agent/current_task.md', 'Artifacts/HANDOFF_BRIEF.md']);
const READABLE_TOOLS = new Set(['read', 'grep', 'find', 'ls']);

// Tool-level boundary only. The filesystem can change between this check and Pi's write.
export function conciergeToolDenial(projectRoot, toolName, input) {
  if (READABLE_TOOLS.has(toolName)) return undefined;
  if (toolName !== 'write' && toolName !== 'edit') return 'Concierge tool is not allowlisted';
  const raw = input?.path;
  if (typeof raw !== 'string' || !raw || raw.includes('\0')) return 'Invalid concierge write path';
  const native = process.platform === 'win32' ? raw.replaceAll('\\', '/') : raw;
  if ((process.platform !== 'win32' && raw.includes('\\')) ||
      native.startsWith('//') || native.startsWith('file:') ||
      native.slice(path.parse(raw).root.length).includes(':') ||
      native.split('/').some(part => part === '.' || part === '..' || /[ .]$/.test(part))) {
    return 'Invalid concierge write path';
  }
  try {
    if (!path.isAbsolute(projectRoot) || fs.lstatSync(projectRoot).isSymbolicLink() ||
        fs.realpathSync(projectRoot) !== path.resolve(projectRoot)) return 'Invalid project root';
    const root = path.resolve(projectRoot);
    const target = path.resolve(root, raw);
    const relative = path.relative(root, target).split(path.sep).join('/');
    // Exact-case comparison also denies Windows short names and alternate spellings.
    if (!WRITABLE.has(relative)) return 'Outside concierge write allowlist';
    const parent = path.dirname(target);
    if (fs.realpathSync(parent) !== parent || !fs.lstatSync(parent).isDirectory()) {
      return 'Linked or missing concierge parent';
    }
    // Check every spelling on disk, including the parent components (Windows is case-insensitive).
    let current = root;
    for (const segment of relative.split('/')) {
      if (!fs.readdirSync(current).includes(segment)) {
        if (segment !== path.basename(target) || current !== parent) return 'Noncanonical concierge path';
      }
      current = path.join(current, segment);
    }
    try {
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
          fs.realpathSync(target) !== target) return 'Linked or non-file concierge target';
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const limit = relative.endsWith('/current_task.md') ? 2000 : 16 * 1024;
    let next;
    if (toolName === 'write') {
      if (typeof input.content !== 'string') return 'Missing concierge write content';
      next = input.content;
    } else {
      if (!Array.isArray(input.edits) || !input.edits.length) return 'Invalid concierge edits';
      const original = fs.readFileSync(target, 'utf8');
      const ranges = [];
      for (const edit of input.edits) {
        if (typeof edit.oldText !== 'string' || !edit.oldText || typeof edit.newText !== 'string') return 'Invalid concierge edit';
        const index = original.indexOf(edit.oldText);
        if (index < 0 || original.indexOf(edit.oldText, index + 1) >= 0) return 'Ambiguous concierge edit';
        ranges.push({ index, end: index + edit.oldText.length, text: edit.newText });
      }
      ranges.sort((a, b) => a.index - b.index);
      if (ranges.some((item, index) => index > 0 && item.index < ranges[index - 1].end)) return 'Overlapping concierge edits';
      next = original;
      for (const item of ranges.reverse()) next = next.slice(0, item.index) + item.text + next.slice(item.end);
    }
    if (Buffer.byteLength(next, 'utf8') > limit) return `Concierge file limit ${limit} bytes`;
    return undefined;
  } catch {
    return 'Unverifiable concierge write path';
  }
}
