import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { validateConciergeEvidence } from '../pi/lib/concierge-evidence.mjs';

test('concierge accepts only bounded main-captured Git/parity stdout and exit in a real project Temp file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-evidence-'));
  const dir = path.join(root, 'Artifacts', 'Temp');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'capture.json');
  const data = { git: { stdout: ' M test\n', stderr: '', exitCode: 0 },
    parity: { stdout: 'source ahead\n', stderr: '', exitCode: 0 } };
  try {
    fs.writeFileSync(file, JSON.stringify(data));
    assert.match(validateConciergeEvidence(root, file).sha256, /^[0-9a-f]{64}$/);
    for (const invalid of [{ ...data, git: { stdout: '', stderr: '' } },
      { ...data, parity: { ...data.parity, exitCode: '0' } }, { ...data, secret: 'should not pass' }]) {
      fs.writeFileSync(file, JSON.stringify(invalid));
      assert.throws(() => validateConciergeEvidence(root, file));
    }
    fs.writeFileSync(file, ' '.repeat(65537));
    assert.throws(() => validateConciergeEvidence(root, file), /64 KiB|limit|large/i);
    fs.writeFileSync(path.join(root, 'outside.json'), JSON.stringify(data));
    assert.throws(() => validateConciergeEvidence(root, path.join(root, 'outside.json')));
    fs.rmSync(file);
    fs.linkSync(path.join(root, 'outside.json'), file);
    assert.throws(() => validateConciergeEvidence(root, file));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('S-C concierge evidence accepts the same file in forward-slash and dot-segment spellings, with negative controls', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-concierge-sc-')));
  const dir = path.join(root, 'Artifacts', 'Temp');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'capture.json');
  const data = { git: { stdout: ' M test\n', stderr: '', exitCode: 0 },
    parity: { stdout: 'source ahead\n', stderr: '', exitCode: 0 } };
  try {
    fs.writeFileSync(file, JSON.stringify(data));
    const forward = file.replaceAll(path.sep, '/');
    const dotted = dir + path.sep + '.' + path.sep + 'capture.json';
    for (const spelling of [file, forward, dotted]) {
      const result = validateConciergeEvidence(root, spelling);
      assert.match(result.sha256, /^[0-9a-f]{64}$/, spelling);
      assert.equal(result.path, file, 'returned path is the canonical native path');
    }
    fs.writeFileSync(path.join(root, 'outside.json'), JSON.stringify(data));
    for (const bad of [path.join(root, 'outside.json'), path.join(root, 'outside.json').replaceAll(path.sep, '/'),
      dir + path.sep + '..' + path.sep + 'outside.json', path.join(dir, 'nested', '..', '..', 'outside.json'),
      '/tmp/capture.json', path.join(dir, 'missing.json')]) {
      assert.throws(() => validateConciergeEvidence(root, bad), undefined, bad);
    }
    fs.writeFileSync(file, JSON.stringify({ ...data, secret: 'x' }));
    assert.throws(() => validateConciergeEvidence(root, forward), /stdout, stderr and exit codes only/);
    fs.rmSync(file);
    fs.linkSync(path.join(root, 'outside.json'), file);
    assert.throws(() => validateConciergeEvidence(root, forward), /unlinked/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
