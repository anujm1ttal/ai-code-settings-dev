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

test('S-C council evidence accepts the same file in forward-slash and dot-segment spellings, with negative controls', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-council-sc-')));
  const temp = path.join(root, 'Artifacts', 'Temp');
  fs.mkdirSync(temp, { recursive: true });
  const file = path.join(temp, 'evidence.txt');
  try {
    fs.writeFileSync(file, 'Synthetic tradeoff A versus B.\n');
    const digest = sha(fs.readFileSync(file));
    const forward = file.replaceAll(path.sep, '/');
    const dotted = temp + path.sep + '.' + path.sep + 'evidence.txt';
    for (const spelling of [file, forward, dotted]) {
      const result = validateCouncilEvidence(root, spelling, digest);
      assert.equal(result.sha256, digest, spelling);
      assert.equal(result.path, file, 'returned path is the canonical native path');
    }
    // Negative controls: normalization must not widen acceptance.
    fs.writeFileSync(path.join(root, 'outside.txt'), 'Synthetic tradeoff A versus B.\n');
    for (const bad of [path.join(root, 'outside.txt'), path.join(root, 'outside.txt').replaceAll(path.sep, '/'),
      temp + path.sep + '..' + path.sep + 'outside.txt', path.join(temp, 'nested', '..', '..', 'outside.txt'),
      '/tmp/evidence.txt', path.join(temp, 'missing.txt')]) {
      assert.throws(() => validateCouncilEvidence(root, bad, digest), undefined, bad);
    }
    assert.throws(() => validateCouncilEvidence(root, forward, '0'.repeat(64)), /SHA-256 mismatch/);
    fs.rmSync(file);
    fs.linkSync(path.join(root, 'outside.txt'), file);
    assert.throws(() => validateCouncilEvidence(root, forward, digest), /single-link/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
