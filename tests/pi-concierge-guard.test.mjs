import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { conciergeToolDenial } from '../pi/lib/concierge-guard.mjs';

test('concierge permits only read tools for valid, missing and invalid roots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-concierge-'));
  try {
    fs.mkdirSync(path.join(root, 'Artifacts', '.agent'), { recursive: true });
    for (const file of ['Artifacts/.agent/current_task.md', 'Artifacts/HANDOFF_BRIEF.md']) {
      fs.writeFileSync(path.join(root, file), 'before');
    }
    for (const projectRoot of [root, undefined, '', 'relative/path', path.join(root, 'missing')]) {
      for (const tool of ['read', 'grep', 'find', 'ls']) {
        assert.equal(conciergeToolDenial(projectRoot, tool, {}), undefined, `${tool}: ${projectRoot}`);
      }
      for (const file of ['Artifacts/.agent/current_task.md', 'Artifacts/HANDOFF_BRIEF.md', 'src/code.ts']) {
        for (const tool of ['write', 'edit']) {
          const input = { path: file, content: 'after', edits: [{ oldText: 'before', newText: 'after' }] };
          assert.match(conciergeToolDenial(projectRoot, tool, input), /.+/, `${tool}: ${file}, root ${projectRoot}`);
        }
      }
      for (const tool of ['bash', 'shell', 'powershell', 'mcp__write', 'unknown']) {
        assert.match(conciergeToolDenial(projectRoot, tool, {}), /.+/, `${tool}: ${projectRoot}`);
      }
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
