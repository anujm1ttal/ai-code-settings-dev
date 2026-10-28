# Pi role-dispatch pilot

Source-only prototype for three independent Pi roles: strategist, coder, and evidence-reviewing auditor. It is not installed into any user-level Pi, Claude, or Codex directory.

## Setup

Requires Pi 1.4.0+, Node.js 22.19+, and credentials for the models you select. Copy [`tests/fixtures/pi-role-policy.json`](../tests/fixtures/pi-role-policy.json) to a **private file outside the public source tree**, substitute your own five exact `provider/model` IDs and three role assignments, then set `PI_ROLE_POLICY_PATH` to its absolute path. Missing or invalid policy prevents the extension from loading; no ambient model is selected as a fallback. Do not put API keys in the policy.

For a local Git Bash session, after creating your private policy at the example path:

```bash
export PI_ROLE_POLICY_PATH="$HOME/.pi/agent/role-policy.json"
pi -e ./pi/extensions/guard.ts -e ./pi/extensions/session-observability.ts -e ./pi/extensions/role-agent.ts
```

Run Pi from a trusted pilot project; point all three `-e` flags to absolute source paths when outside this repo. The parent loads the guard and bounded session observability explicitly; shell/write-capable role children receive **only** the guard, with ordinary extension discovery disabled. The report-only auditor retains its no-shell/no-write tools. Observability reads `Artifacts/.agent/current_task.md` once per session (≤2,000 B) when present; it does **not** validate that file's age, so verify its objective against the active TODO before acting. It writes completed-tool **metadata only** to an existing project's `Artifacts/.agent/pi-audit.jsonl` (64 KiB cap, recent validated rows retained). It records tool type/outcome/time, never command, tool arguments, file path or result content; it does not audit user-typed direct shell or child-internal calls and adds no automatic completion nag. This is a source-only preview, not a global installation or OS sandbox. `/pi-roles` shows the loaded private assignments. Ask Pi to call `pi_role_agent` with `{"role":"strategist","task":"Plan a bounded change"}`; the other roles are `coder` and `auditor`.

## Pi prompt templates (source-only preview)

`prompts/{blueprint,implement,audit,explain,triage,grill,registry-audit,snapshot,sync,ingest,learn,clean,graduate,skill-graph,sweep,agents-md,docs,handoff}.md` can be selected for one Pi process with repeated `--prompt-template <absolute-source-path>` flags. They are **not installed** into your user-level Pi prompts. In a disposable consuming project, load the pilot extension with `-e <absolute-path-to-role-agent.ts>`, set the private policy environment variable, and add only the templates you are testing. Then invoke a selected `/name` command in Pi. `/blueprint`, `/grill` request a strategist child; `/implement`, `/triage` request a coder child; `/audit`, `/registry-audit`, `/snapshot` request a report-only auditor child with main-session captured evidence. `/explain` uses the already discoverable `codebase-navigator` skill in the main session because no scribe child is configured. `/sync`, `/ingest`, `/learn`, and `/clean` run in the main session without claiming an isolated concierge; `/clean` requires explicit confirmation before any deletion. `/graduate` is source-repo-only and report-first, `/skill-graph` uses a strategist, and `/sweep` uses only configured pilot child roles plus a main-session docs scan. `/agents-md` is the Pi report-only successor to Claude's `/claude-md`; it does not invoke the Claude plugin. `/docs` updates *repository* docs with `doc-updater` in the main session, not the separate user-level `/skill:docs` connector. Pi `/handoff` is **local-state-only** by user decision: it updates project state, prepares a brief, and reports backup pending. GitHub backup is a separate authorized action; the existing Claude/Codex `/handoff` push requirement is unchanged. If the extension is missing, child-routed templates must stop rather than claim a role was dispatched.

A project-local `AGENTS.md` and optional Pi global context are separate from prompt templates. The global proposal lives in `Pi-global.md` at this repo's root; it includes eight **Pi-specific common-rule summaries**, not auto-loaded copies of Claude `rules/common/`. In a disposable consumer, explicitly preview that source file with `--append-system-prompt <absolute-path-to-Pi-global.md>`; without that flag the preview is absent. Neither it nor these templates is installed by this source pilot. Raw test output and exit status must be retained by the main session in a file the auditor actually reads, including for an audit following `/implement`; only an explicit project authority rule permits transcribing the auditor's cited PASS into a TODO marker. Do not use legacy `/skill:source-command-*` wrappers as evidence of Pi-native isolated routing.

## Project-scoped optional plugins

See [`plugins/README.md`](plugins/README.md) for the source-only Pi local-package pattern. The manuscript pilot loads one selected skill in an explicitly trusted disposable project and not in an untrusted or control project; it does not install the package globally or validate editorial behavior. `code-mcp`, `geometry`, and `manuscript` have source-only opt-in/control checks. Geometry's first-party Pi bridge resolves the existing XML resources from the loaded skill location, not Claude's plugin-root token; it does not copy or relicense those XML files. The `pbi-report`, `visual-storytelling`, and `youtube` groups also have source-only opt-in/control checks; visual-storytelling uses its own Pi path bridge for slide validators. These checks prove resource routing, not that a creative-director/scribe child ran or that a Power BI report, deck, or video was produced.

## Workflow

`extensions/role-agent.ts` registers one tool and one inspection command. `lib/role-policy.mjs` loads and validates the private policy; `lib/role-runner.mjs` starts a separate Pi process for each role, setting the exact provider/model, thinking level, and tool list. It checks the completed assistant message's **reported** provider/model and thinking level, aggregates usage across turns, and rejects mismatches. That observation does not prove the provider applied a particular reasoning budget.

Before requesting an audit, the orchestrator runs the appropriate tests, captures the **raw output and exit status** in a file accessible to the auditor, and gives the auditor that file path plus the code paths to inspect. The auditor can read evidence and source but has **no `bash`, `powershell`, `edit`, or `write` tools**. It must return INCOMPLETE if evidence is missing or stale; it cannot rerun tests itself. The coder still has shell and write access.

## Isolated release rehearsal (T16)

Run `node --test tests/pi-release.test.mjs` from the repo root. It creates a marked sandbox under the OS temp directory, stages the Pi-only source into its `agent/` folder, checks Pi resource discovery in a fresh disposable consumer, and restores the prior sandbox `agent/` tree byte-for-byte from `backup/` before deleting the sandbox. `pi/lib/release-preview.mjs` rejects unmarked or non-temp destinations, existing backups, and symlinks/junctions at either stage root or within its tree. It stages `Pi-global.md` as `AGENTS.md`, the three-role source, three Pi extensions, prompt templates, and the shared first-party license-gate config; optional plugin packages stay project-selected from their source directories. The test sets `PI_CODING_AGENT_DIR` to the sandbox and uses a synthetic role policy. **This is not a live deploy**: it does not install into `~/.pi/agent/`, `~/.claude/`, `~/.codex/` or another project. A release-capable deployment path requires separate T17 review and T18 user approval.

## Verification

From the repo root:

```bash
node --test tests/pi-*.test.mjs
python -m pytest tests/ -q
```

The public test fixture uses invented provider IDs. A real provider smoke run requires your own private policy and may incur model usage. Nothing is deployed by the test commands.

## Limits

- This is a pilot, not a migration of all commands, rules, skills, plugins, or hooks. A live Pi parent invoked the extension's `pi_role_agent` tool for one strategist task and received a valid child result. The full three-role fixture flow was driven through `runRole()` directly, not through the extension as a multi-agent workflow.
- A tool allowlist and the Pi guard are **not a security sandbox**. Model subprocesses inherit the Pi process environment, including credentials used to call their providers. The coder has `bash` and can access inherited keys; run only trusted tasks and projects. The guard sees Pi `tool_call` and user `!`/`!!` (`user_bash`) in processes that load it; it does not inspect shell scripts after launch, indirect writes or unguarded external processes. Dangerous direct shell asks for confirmation with a UI and denies without one. Keep stronger isolation in scope before global or unattended deployment.
- The auditor's lack of shell prevents independent test reruns. A caller-supplied summary is not evidence: it must read captured raw output and compare it with the source itself.
- The runner uses a ten-minute default child deadline and a two-second force-kill grace period; actual multi-minute and cancellation behavior has not been production-tested. An isolated Pi agent-directory preview and byte-for-byte rollback have been exercised; **live** private-policy installation, user-level instruction loading, rollback and cross-project behavior have not been implemented or audited.
