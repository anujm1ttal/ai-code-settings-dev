import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const MAX_BYTES = 64 * 1024;

export function validateConciergeEvidence(root, file) {
  if (typeof root !== 'string' || !path.isAbsolute(root) ||
      typeof file !== 'string' || !path.isAbsolute(file)) throw new Error('Absolute evidence and project paths required');
  const expectedDir = path.join(path.resolve(root), 'Artifacts', 'Temp');
  if (path.dirname(file) !== expectedDir || fs.realpathSync(expectedDir) !== expectedDir ||
      fs.realpathSync(root) !== path.resolve(root)) throw new Error('Concierge evidence must be in real project Artifacts/Temp');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Concierge evidence must be a regular unlinked file');
  if (stat.size > MAX_BYTES || stat.size === 0) throw new Error('Concierge evidence exceeds 64 KiB limit or is empty');
  const bytes = fs.readFileSync(file);
  if (bytes.length > MAX_BYTES) throw new Error('Concierge evidence exceeds 64 KiB limit');
  const capture = JSON.parse(bytes.toString('utf8'));
  if (!capture || Object.keys(capture).sort().join(',') !== 'git,parity' ||
      ![capture.git, capture.parity].every(item => item &&
        Object.keys(item).sort().join(',') === 'exitCode,stderr,stdout' &&
        Number.isSafeInteger(item.exitCode) && typeof item.stdout === 'string' && typeof item.stderr === 'string')) {
    throw new Error('Concierge evidence must contain captured Git/parity stdout, stderr and exit codes only');
  }
  return { path: file, sha256: createHash('sha256').update(bytes).digest('hex') };
}
