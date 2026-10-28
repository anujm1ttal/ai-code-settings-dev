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
