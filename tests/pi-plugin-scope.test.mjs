import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgRoot = path.join(root, 'optional_plugins/manuscript');
const sdkPath = process.env.PI_CODING_AGENT_SDK_PATH;

for (const group of [
  { name: 'pbi-report', skills: ['powerbi-report'], assets: { 'powerbi-report': ['references/theme-defaults.json', 'references/wireframe-examples.md'] } },
  { name: 'visual-storytelling', skills: ['banana-prompt', 'pptx-slide-design'], assets: { 'banana-prompt': ['references/presets.md'], 'pptx-slide-design': ['references/reference-slides.md', 'data/archetypes.yaml', 'data/profiles.yaml', 'scripts/validate_prompt.py', 'scripts/contrast_check.py'] } },
  { name: 'youtube', skills: ['youtube-strategy', 'youtube-scriptwriting', 'youtube-retention'], assets: {} },
]) {
  test(`${group.name} is project-scoped and resolves its bundled files`, async (t) => {
    const guide = fs.readFileSync(path.join(root, 'pi/plugins/README.md'), 'utf8');
    assert.match(guide, new RegExp(`## ${group.name}`));
    const bridge = fs.readFileSync(path.join(root, `pi/plugins/${group.name}/APPEND_SYSTEM.md`), 'utf8');
    if (group.name === 'visual-storytelling') {
      assert.match(bridge, /\$\{CLAUDE_PLUGIN_ROOT\}/);
      assert.match(bridge, /skill.*location/is);
      assert.match(bridge, /creative-director.*not configured/is);
    } else {
      assert.match(bridge, /(?:creative-director|scribe).*not configured/is);
      assert.match(bridge, /main session/i);
    }
    if (!sdkPath) return t.skip('Set PI_CODING_AGENT_SDK_PATH for Pi runtime discovery');
    const { DefaultResourceLoader } = await import(pathToFileURL(sdkPath).href);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), `pi-t11-${group.name}-`));
    const agentDir = path.join(temp, 'agent');
    const opted = path.join(temp, 'opted');
    const control = path.join(temp, 'control');
    try {
      for (const dir of [agentDir, opted, control]) fs.mkdirSync(dir);
      fs.mkdirSync(path.join(opted, '.pi'));
      fs.writeFileSync(path.join(opted, '.pi/settings.json'), JSON.stringify({ packages: [{
        source: path.join(root, 'optional_plugins', group.name),
        skills: group.skills.map(n => `skills/${n}/SKILL.md`), extensions: [], prompts: [], themes: [],
      }] }));
      for (const [cwd, expected] of [[opted, group.skills.length], [control, 0]]) {
        const loader = new DefaultResourceLoader({ cwd, agentDir });
        await loader.reload();
        const { skills, diagnostics } = loader.getSkills();
        const selected = skills.filter(s => group.skills.includes(s.name));
        assert.equal(selected.length, expected, `${cwd}: ${JSON.stringify(diagnostics)}`);
        for (const skill of selected) {
          assert.equal(path.dirname(skill.filePath), skill.baseDir);
          for (const asset of group.assets[skill.name] ?? []) {
            assert.ok(fs.statSync(path.join(skill.baseDir, asset)).size > 0, `${skill.name}/${asset}`);
          }
        }
      }
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  });
}

test('geometry opts into five skills and resolves resources from skill locations without Claude plugin-root substitution', async (t) => {
  const bridge = fs.readFileSync(path.join(root, 'pi/plugins/geometry/APPEND_SYSTEM.md'), 'utf8');
  assert.match(bridge, /\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.match(bridge, /Pi.*skill.*location/is);
  assert.match(bridge, /geometry-validator.*not configured/is);
  if (!sdkPath) return t.skip('Set PI_CODING_AGENT_SDK_PATH for Pi runtime discovery');
  const { DefaultResourceLoader } = await import(pathToFileURL(sdkPath).href);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t10-geometry-'));
  const agentDir = path.join(temp, 'agent');
  const opted = path.join(temp, 'opted');
  const control = path.join(temp, 'control');
  const names = ['cd-foundations', 'grasshopper-plugin-packaging', 'python-rhino-grasshopper', 'rhino-e2e-testing', 'rhino-unit-testing'];
  try {
    for (const dir of [agentDir, opted, control]) fs.mkdirSync(dir);
    fs.mkdirSync(path.join(opted, '.pi'));
    fs.writeFileSync(path.join(opted, '.pi/settings.json'), JSON.stringify({ packages: [{
      source: path.join(root, 'optional_plugins/geometry'),
      skills: names.map(n => `skills/${n}/SKILL.md`), extensions: [], prompts: [], themes: [],
    }] }));
    for (const [cwd, expected] of [[opted, names.length], [control, 0]]) {
      const loader = new DefaultResourceLoader({ cwd, agentDir });
      await loader.reload();
      const { skills, diagnostics } = loader.getSkills();
      const selected = skills.filter(s => names.includes(s.name));
      assert.equal(selected.length, expected, `${cwd}: ${JSON.stringify(diagnostics)}`);
      for (const skill of selected) assert.equal(path.dirname(skill.filePath), skill.baseDir);
      if (expected) {
        const base = selected.find(s => s.name === 'python-rhino-grasshopper').baseDir;
        for (const file of ['RhinoCommon.xml', 'Grasshopper.xml', 'GH_IO.XML']) {
          assert.ok(fs.statSync(path.join(base, 'resources', file)).size > 100_000);
        }
        assert.ok(fs.existsSync(path.join(selected.find(s => s.name === 'rhino-e2e-testing').baseDir, 'resources/probe_harness.py')));
        assert.ok(fs.existsSync(path.join(selected.find(s => s.name === 'grasshopper-plugin-packaging').baseDir, 'references/yak-cli.md')));
      }
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('code-mcp opts into two first-party skills with bundled references without global leakage', async (t) => {
  const guide = fs.readFileSync(path.join(root, 'pi/plugins/README.md'), 'utf8');
  assert.match(guide, /## Code MCP/);
  if (!sdkPath) return t.skip('Set PI_CODING_AGENT_SDK_PATH for Pi runtime discovery');
  const { DefaultResourceLoader } = await import(pathToFileURL(sdkPath).href);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t10-code-mcp-'));
  const agentDir = path.join(temp, 'agent');
  const opted = path.join(temp, 'opted');
  const control = path.join(temp, 'control');
  try {
    for (const dir of [agentDir, opted, control]) fs.mkdirSync(dir);
    fs.mkdirSync(path.join(opted, '.pi'));
    fs.writeFileSync(path.join(opted, '.pi/settings.json'), JSON.stringify({ packages: [{
      source: path.join(root, 'optional_plugins/code-mcp'),
      skills: ['skills/python-mcp/SKILL.md', 'skills/typescript-mcp/SKILL.md'],
      extensions: [], prompts: [], themes: [],
    }] }));
    for (const [cwd, expected] of [[opted, 2], [control, 0]]) {
      const loader = new DefaultResourceLoader({ cwd, agentDir });
      await loader.reload();
      const { skills, diagnostics } = loader.getSkills();
      const matches = skills.filter(s => ['python-mcp', 'typescript-mcp'].includes(s.name));
      assert.equal(matches.length, expected, `${cwd}: ${JSON.stringify(diagnostics)}`);
      for (const skill of matches) {
        assert.equal(path.dirname(skill.filePath), skill.baseDir);
        assert.ok(fs.readdirSync(path.join(skill.baseDir, 'references')).length > 0);
      }
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('manuscript skill states the Pi pilot role boundary without changing Claude activation', () => {
  const text = fs.readFileSync(path.join(pkgRoot, 'skills/manuscript-review/SKILL.md'), 'utf8');
  assert.match(text, /Claude Code.*coder.*inactive/s);
  assert.match(text, /Pi pilot.*project.*opt-in/s);
  assert.match(text, /Pi pilot.*report-only auditor/s);
  assert.match(text, /model:.*does not.*select.*Pi/s);
});

test('one project-local package selection exposes manuscript skill only to the opted-in consumer', async (t) => {
  const guide = fs.readFileSync(path.join(root, 'pi/plugins/README.md'), 'utf8');
  assert.match(guide, /project.*\.pi\/settings\.json/i);
  assert.match(guide, /--approve/);
  assert.match(guide, /not.*global/i);
  if (!sdkPath) return t.skip('Set PI_CODING_AGENT_SDK_PATH to the installed Pi dist/index.js for runtime discovery');
  const { DefaultResourceLoader } = await import(pathToFileURL(sdkPath).href);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t9-'));
  const agentDir = path.join(temp, 'agent');
  const opted = path.join(temp, 'opted');
  const control = path.join(temp, 'control');
  try {
    for (const dir of [agentDir, opted, control]) fs.mkdirSync(dir);
    fs.mkdirSync(path.join(opted, '.pi'));
    fs.writeFileSync(path.join(opted, '.pi/settings.json'), JSON.stringify({ packages: [{
      source: pkgRoot,
      extensions: [], prompts: [], themes: [], skills: ['skills/manuscript-review/SKILL.md'],
    }] }));
    for (const [cwd, present] of [[opted, true], [control, false]]) {
      const loader = new DefaultResourceLoader({ cwd, agentDir });
      await loader.reload();
      const { skills, diagnostics } = loader.getSkills();
      const matches = skills.filter(s => s.name === 'manuscript-review');
      assert.equal(matches.length, present ? 1 : 0, `${cwd}: ${JSON.stringify(diagnostics)}`);
      if (present) {
        assert.equal(path.resolve(matches[0].filePath), path.join(pkgRoot, 'skills/manuscript-review/SKILL.md'));
        for (const name of ['market-standards.md', 'editorial-standards.md']) {
          assert.ok(fs.existsSync(path.join(matches[0].baseDir, 'references', name)));
        }
      }
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
