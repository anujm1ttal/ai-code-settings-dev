import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateCouncilEvidence } from '../pi/lib/council-evidence.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('council evidence has an exact common digest, 64 KiB cap and real single-link Temp path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-council-evidence-'));
  const temp = path.join(root, 'Artifacts', 'Temp');
  fs.mkdirSync(temp, { recursive: true });
  const file = path.join(temp, 'evidence.txt');
  try {
    fs.writeFileSync(file, 'Synthetic tradeoff A versus B.\n');
    const digest = sha(fs.readFileSync(file));
    assert.equal(validateCouncilEvidence(root, file, digest).sha256, digest);
    assert.throws(() => validateCouncilEvidence(root, file, '0'.repeat(64)), /hash|digest|sha/i);
    assert.throws(() => validateCouncilEvidence(root, file, undefined), /hash|digest|sha/i);
    fs.writeFileSync(file, 'x'.repeat(65537));
    assert.throws(() => validateCouncilEvidence(root, file, sha(fs.readFileSync(file))), /64 KiB|limit/i);
    fs.writeFileSync(path.join(root, 'outside.txt'), 'Synthetic tradeoff A versus B.\n');
    assert.throws(() => validateCouncilEvidence(root, path.join(root, 'outside.txt'), digest));
    fs.rmSync(file);
    fs.linkSync(path.join(root, 'outside.txt'), file);
    assert.throws(() => validateCouncilEvidence(root, file, digest));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
