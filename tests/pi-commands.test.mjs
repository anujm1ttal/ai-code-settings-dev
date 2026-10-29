import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('/council routes through bounded collection and retains advisory authority', () => {
  const template = readFileSync(new URL('../pi/prompts/council.md', import.meta.url), 'utf8');
  assert.match(template, /pi_council/);
  assert.match(template, /evidenceSha256/);
  assert.match(template, /advisory/i);
  assert.match(template, /disagreement/i);
  assert.match(template, /no.*decision.log|do not.*decision.log/i);
  assert.match(template, /\$ARGUMENTS/);
});

test('/blueprint template requests the isolated strategist rather than impersonating it', () => {
  const template = readFileSync(new URL('../pi/prompts/blueprint.md', import.meta.url), 'utf8');
  assert.match(template, /pi_role_agent/);
  assert.match(template, /role[^\n]*strategist/);
  assert.match(template, /\$ARGUMENTS/);
  assert.doesNotMatch(template, /claude-opus|Agent tool|Claude Agent Teams/i);
});

test('/audit template requires captured raw evidence and an isolated report-only auditor', () => {
  const template = readFileSync(new URL('../pi/prompts/audit.md', import.meta.url), 'utf8');
  assert.match(template, /pi_role_agent/);
  assert.match(template, /role[^\n]*auditor/);
  assert.match(template, /raw.*exit status/i);
  assert.match(template, /INCOMPLETE/);
  assert.match(template, /\$ARGUMENTS/);
});

test('/implement template delegates only approved bounded work to the isolated coder', () => {
  const template = readFileSync(new URL('../pi/prompts/implement.md', import.meta.url), 'utf8');
  assert.match(template, /pi_role_agent/);
  assert.match(template, /role[^\n]*coder/);
  assert.match(template, /failing test/i);
  assert.match(template, /raw.*output.*exit status.*file/i);
  assert.match(template, /auditor.*read.*path/i);
  assert.match(template, /INCOMPLETE/);
  assert.match(template, /explicit project task-authority rule/i);
  assert.match(template, /\$ARGUMENTS/);
});

test('/explain requires an isolated read-only scribe and navigator skill', () => {
  const template = readFileSync(new URL('../pi/prompts/explain.md', import.meta.url), 'utf8');
  assert.match(template, /codebase-navigator/);
  assert.match(template, /pi_role_agent/);
  assert.match(template, /role[^\n]*scribe/);
  assert.match(template, /missing.*policy.*stop|unavailable.*stop/i);
  assert.match(template, /\$ARGUMENTS/);
});

test('/triage routes an assigned bug to the coder without applying a fix', () => {
  const template = readFileSync(new URL('../pi/prompts/triage.md', import.meta.url), 'utf8');
  assert.match(template, /pi_role_agent/);
  assert.match(template, /role[^\n]*coder/);
  assert.match(template, /systematic-debugging/);
  assert.match(template, /no source fix/i);
  assert.match(template, /verification-gate/);
  assert.match(template, /high-severity.*audit/i);
  assert.match(template, /details\.role/);
  assert.match(template, /\$ARGUMENTS/);
});

test('/grill routes plan challenge to strategist without premature approval', () => {
  const template = readFileSync(new URL('../pi/prompts/grill.md', import.meta.url), 'utf8');
  assert.match(template, /pi_role_agent/);
  assert.match(template, /role[^\n]*strategist/);
  assert.match(template, /one question at a time/i);
  assert.match(template, /do not declare.*APPROVED/i);
  assert.match(template, /\$ARGUMENTS/);
});

test('/registry-audit supplies raw inventory to a report-only auditor', () => {
  const template = readFileSync(new URL('../pi/prompts/registry-audit.md', import.meta.url), 'utf8');
  assert.match(template, /pi_role_agent/);
  assert.match(template, /role[^\n]*auditor/);
  assert.match(template, /raw.*inventory/i);
  assert.match(template, /INCOMPLETE/);
  assert.match(template, /\$ARGUMENTS/);
});

test('/snapshot uses a read-only auditor and excludes secrets from factual output', () => {
  const template = readFileSync(new URL('../pi/prompts/snapshot.md', import.meta.url), 'utf8');
  assert.match(template, /pi_role_agent/);
  assert.match(template, /role[^\n]*auditor/);
  assert.match(template, /raw.*inventory/i);
  assert.match(template, /secrets/i);
  assert.match(template, /facts only/i);
  assert.match(template, /15 sections/i);
  assert.match(template, /file:line/i);
  assert.match(template, /single Markdown/i);
  assert.match(template, /\$ARGUMENTS/);
});

test('/sync reconciles state in the main session on a real project with no child dispatch', () => {
  const template = readFileSync(new URL('../pi/prompts/sync.md', import.meta.url), 'utf8');
  assert.match(template, /main session/i);
  assert.match(template, /real project/i);
  assert.match(template, /deploy parity/i);
  assert.match(template, /verify_deploy_parity/);
  assert.match(template, /exit 1/i);
  assert.match(template, /current_task\.md/);
  assert.match(template, /RECONCILED/);
  assert.match(template, /DRIFT/);
  assert.match(template, /STALE/);
  assert.match(template, /MISMATCH/);
  assert.match(template, /BACKLOG/);
  assert.match(template, /no.*\[x\]/i);
  assert.match(template, /local-only/i);
  assert.match(template, /\$ARGUMENTS/);
  assert.doesNotMatch(template, /pi_role_agent/);
  assert.doesNotMatch(template, /disposable/i);
  assert.doesNotMatch(template, /concierge/i);
});

test('/ingest validates external input without claiming completion', () => {
  const template = readFileSync(new URL('../pi/prompts/ingest.md', import.meta.url), 'utf8');
  assert.match(template, /main session/i);
  assert.match(template, /schema/i);
  assert.match(template, /Hard Fail/);
  assert.match(template, /do not quote.*secret/i);
  assert.match(template, /no `?\[x\]/i);
  assert.match(template, /\$ARGUMENTS/);
});

test('/learn keeps local and global lesson destinations separate', () => {
  const template = readFileSync(new URL('../pi/prompts/learn.md', import.meta.url), 'utf8');
  assert.match(template, /main session/i);
  assert.match(template, /Artifacts\/learnings/);
  assert.match(template, /GLOBAL_INBOX/);
  assert.match(template, /user instruction/i);
  assert.match(template, /--global/);
  assert.match(template, /\$ARGUMENTS/);
});

test('/clean previews candidates and requires confirmation before deletion', () => {
  const template = readFileSync(new URL('../pi/prompts/clean.md', import.meta.url), 'utf8');
  assert.match(template, /main session/i);
  assert.match(template, /do not scan, list, or propose.*Artifacts\/Evidence/i);
  assert.match(template, /skip.*Temp.*high-rigor/i);
  assert.match(template, /explicit confirmation/i);
  assert.match(template, /no deletion/i);
  assert.match(template, /\$ARGUMENTS/);
});

test('/graduate previews source-only destinations and never edits a deployed copy', () => {
  const template = readFileSync(new URL('../pi/prompts/graduate.md', import.meta.url), 'utf8');
  assert.match(template, /main session/i);
  assert.match(template, /ai-code-settings/);
  assert.match(template, /GLOBAL_INBOX/);
  assert.match(template, /source only/i);
  assert.match(template, /explicit user decision/i);
});

test('/skill-graph includes core and optional plugin skills before strategist analysis', () => {
  const template = readFileSync(new URL('../pi/prompts/skill-graph.md', import.meta.url), 'utf8');
  assert.match(template, /pi_role_agent/);
  assert.match(template, /role[^\n]*strategist/);
  assert.match(template, /optional_plugins/);
  assert.match(template, /skills\//);
  assert.match(template, /no deletion/i);
});

test('/sweep replaces Claude Teams with bounded Pi roles and main-session doc scan', () => {
  const template = readFileSync(new URL('../pi/prompts/sweep.md', import.meta.url), 'utf8');
  assert.match(template, /pi_role_agent/);
  assert.match(template, /role[^\n]*strategist/);
  assert.match(template, /role[^\n]*coder/);
  assert.match(template, /main-session documentation/i);
  assert.match(template, /no Claude Teams/i);
  assert.match(template, /no automatic TODO edits/i);
});

test('/agents-md replaces the Claude-specific audit with report-only Pi AGENTS review', () => {
  const template = readFileSync(new URL('../pi/prompts/agents-md.md', import.meta.url), 'utf8');
  assert.match(template, /pi_role_agent/);
  assert.match(template, /role[^\n]*auditor/);
  assert.match(template, /AGENTS\.md/);
  assert.match(template, /report first/i);
  assert.match(template, /explicit confirmation/i);
  assert.doesNotMatch(template, /claude-md-improver/);
});

test('/docs uses repo doc-updater in main session without a fake scribe child', () => {
  const template = readFileSync(new URL('../pi/prompts/docs.md', import.meta.url), 'utf8');
  assert.match(template, /main session/i);
  assert.match(template, /doc-updater/);
  assert.match(template, /--internal/);
  assert.match(template, /--reference/);
  assert.match(template, /no Claude Teams/i);
  assert.doesNotMatch(template, /role[^\n]*scribe/);
});

test('Pi global preview routes each of the eight common-rule dispositions without Claude load-scoping', () => {
  const source = readFileSync(new URL('../Pi-global.md', import.meta.url), 'utf8');
  const section = source.split('## Pi common-rule routing (Pi-facing summaries)')[1]?.split('\n## ')[0] ?? '';
  for (const name of ['architecture', 'claude-md-standards', 'coding-style', 'model-routing', 'orchestration', 'security', 'standards', 'testing-strategy']) {
    assert.match(section, new RegExp('^\\- \\*\\*' + name + '\\*\\*:', 'm'), name);
  }
  assert.match(section, /does not load.*rules\/common/i);
  assert.match(section, /no Claude `paths:`/i);
  assert.match(section, /report-only auditor/i);
  const orchestration = section.split('\n').find(line => line.startsWith('- **orchestration**:')) ?? '';
  assert.match(orchestration, /no implementation[^.]*before the user approves the plan/i);
  assert.match(orchestration, /DRAFT plan or untagged task is not approved/);
  assert.match(orchestration, /"go ahead" does not approve a draft/);
  assert.ok(Buffer.byteLength(source, 'utf8') <= 6743, 'Pi-global.md must stay within the 512 B Phase 2 growth ceiling over 6,231 B');
});

test('/handoff runs in the main session, saves state locally and leaves backup to a separate action', () => {
  const template = readFileSync(new URL('../pi/prompts/handoff.md', import.meta.url), 'utf8');
  assert.match(template, /main session/i);
  assert.match(template, /real project/i);
  assert.match(template, /current_task\.md/);
  assert.match(template, /2,000/);
  assert.match(template, /HANDOFF_BRIEF\.md/);
  assert.match(template, /DECISION_LOG\.md/);
  assert.match(template, /--lite/);
  assert.match(template, /--phase/);
  assert.match(template, /local-only/i);
  assert.match(template, /separate.*backup/i);
  assert.match(template, /no `?\[x\]/i);
  assert.doesNotMatch(template, /pi_role_agent/);
  assert.doesNotMatch(template, /disposable/i);
  assert.doesNotMatch(template, /concierge/i);
  assert.doesNotMatch(template, /git\s+(?:-C\s+Artifacts\s+)?(?:commit|push)/i);
});
