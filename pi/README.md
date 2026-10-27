# Pi role-dispatch pilot

Source-only prototype for three independent Pi roles: strategist, coder, and evidence-reviewing auditor. It is not installed into any user-level Pi, Claude, or Codex directory.

## Setup

Requires Pi 1.4.0+, Node.js 22.19+, and credentials for the models you select. Copy [`tests/fixtures/pi-role-policy.json`](../tests/fixtures/pi-role-policy.json) to a **private file outside the public source tree**, substitute your own five exact `provider/model` IDs and three role assignments, then set `PI_ROLE_POLICY_PATH` to its absolute path. Missing or invalid policy prevents the extension from loading; no ambient model is selected as a fallback. Do not put API keys in the policy.

For a local Git Bash session, after creating your private policy at the example path:

```bash
export PI_ROLE_POLICY_PATH="$HOME/.pi/agent/role-policy.json"
pi -e ./pi/extensions/role-agent.ts
```

Run Pi from a trusted pilot project; point `-e` to the extension's absolute source path if you are not in this repo. `/pi-roles` shows the loaded private assignments. Ask Pi to call `pi_role_agent` with `{"role":"strategist","task":"Plan a bounded change"}`; the other roles are `coder` and `auditor`.

## Workflow

`extensions/role-agent.ts` registers one tool and one inspection command. `lib/role-policy.mjs` loads and validates the private policy; `lib/role-runner.mjs` starts a separate Pi process for each role, setting the exact provider/model, thinking level, and tool list. It checks the completed assistant message's **reported** provider/model and thinking level, aggregates usage across turns, and rejects mismatches. That observation does not prove the provider applied a particular reasoning budget.

Before requesting an audit, the orchestrator runs the appropriate tests, captures the **raw output and exit status** in a file accessible to the auditor, and gives the auditor that file path plus the code paths to inspect. The auditor can read evidence and source but has **no `bash`, `powershell`, `edit`, or `write` tools**. It must return INCOMPLETE if evidence is missing or stale; it cannot rerun tests itself. The coder still has shell and write access.

## Verification

From the repo root:

```bash
node --test tests/pi-*.test.mjs
python -m pytest tests/ -q
```

The public test fixture uses invented provider IDs. A real provider smoke run requires your own private policy and may incur model usage. Nothing is deployed by the test commands.

## Limits

- This is a pilot, not a migration of all commands, rules, skills, plugins, or hooks. A live Pi parent invoked the extension's `pi_role_agent` tool for one strategist task and received a valid child result. The full three-role fixture flow was driven through `runRole()` directly, not through the extension as a multi-agent workflow.
- A tool allowlist is **not a security sandbox**. Model subprocesses inherit the Pi process environment, including credentials used to call their providers. The coder has `bash` and can access inherited keys; run only trusted tasks and projects. Keep stronger isolation in scope before global or unattended deployment.
- The auditor's lack of shell prevents independent test reruns. A caller-supplied summary is not evidence: it must read captured raw output and compare it with the source itself.
- The runner uses a ten-minute default child deadline and a two-second force-kill grace period; actual multi-minute and cancellation behavior has not been production-tested. Private policy deployment, user-level instruction loading, rollback, and cross-project behavior have not yet been implemented or audited.
