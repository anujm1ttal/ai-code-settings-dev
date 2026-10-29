import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function validateCouncilEvidence(root, file, expectedSha256) {
  if (typeof expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new Error('Council evidence requires an exact SHA-256 digest');
  }
  if (typeof root !== 'string' || typeof file !== 'string' || !path.isAbsolute(root) || !path.isAbsolute(file)) {
    throw new Error('Council evidence requires absolute project and file paths');
  }
  file = path.resolve(file); // canonical native spelling; every check below still applies to the result
  const directory = path.join(path.resolve(root), 'Artifacts', 'Temp');
  if (path.dirname(file) !== directory || fs.realpathSync(root) !== path.resolve(root) ||
      fs.realpathSync(directory) !== directory) throw new Error('Council evidence must be in real project Artifacts/Temp');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Council evidence must be a regular single-link file');
  if (!stat.size || stat.size > 64 * 1024) throw new Error('Council evidence exceeds 64 KiB limit or is empty');
  const bytes = fs.readFileSync(file);
  if (bytes.length > 64 * 1024) throw new Error('Council evidence exceeds 64 KiB limit');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== expectedSha256) throw new Error('Council evidence SHA-256 mismatch');
  return { path: file, sha256 };
}
