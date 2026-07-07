# Anti-Pattern: Enforcement Config That Was Never Runtime-Verified

**Category:** anti-patterns
**First seen:** 2026-07-07 (OSH audit)

## The gotcha

The OS's entire "Enforcement Layer" (hooks) was largely non-functional and nobody knew:
- `session-boot.js` emitted top-level `additionalContext` — a shape the harness **drops** — so
  the flagship state-recovery hook injected **nothing** into any session.
- Both PreToolUse guards printed their deny reason to stdout with exit 2, but on exit 2 only
  **stderr** reaches Claude — they blocked work while giving zero explanation.
- `auto-lint.js` reports went to the same dropped channel.

The break was invisible because **fail-open masks a broken guard exactly like a passing one** —
a hook that errors and a hook that does nothing both exit 0 and produce no visible signal. The
config *existed*, the table in CLAUDE-global *claimed* enforcement, and no one had run a live
behavioral test against the actual hook API.

## The rule

- **Config existence ≠ runtime honored.** A hook/gate/CI rule is unverified until you observe it
  *behaving* — pipe synthetic input through it and assert the output schema + exit code, then do
  one live end-to-end trigger.
- When a mechanism is **fail-open**, you cannot infer health from "no errors seen." Add a
  positive test that fails loudly when the mechanism is broken.
- Verify against the **current API contract** (field names, exit-code semantics), not against
  what the schema looked like when first written — APIs drift.

## Related
[[deploy-stale-after-subsystem-retire]] (same family: an enforcement/automation artifact silently
stopped working and only a real run exposed it) · reinforces HOT #6 Verify Centrally After Fan-Out.
