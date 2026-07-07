---
name: codebase-navigator
description: Interactive codebase explanation and teaching. Use when a user asks how a codebase works, wants a tour of unfamiliar code, needs architecture explained, asks "what does X do?", "where does Y happen?", "walk me through Z", or wants to understand data flow, call chains, module dependencies, or design decisions. Activated by the scribe in Explain mode. Should trigger whenever the user is trying to build mental models of code rather than change it. Do NOT use for writing or updating persisted documentation — use doc-updater instead; do NOT use for implementing or refactoring code — route to the coder agent.
argument-hint: "<file_path_or_symbol_to_explain>"
metadata:
  version: "1.0.1"
  tags: [codebase, navigation, architecture, search, code-explanation, scribe]
---


# Skill: Codebase Navigator

Bridge between raw code and human understanding. The goal is not to document — it is to transfer a working mental model to the reader as fast as possible.

## Modes

Choose based on the user's question:

| Mode | Trigger | Output |
|:---|:---|:---|
| **Overview** | "How does X work?" / "Give me a tour" | 10-second summary → ASCII map → key entry points |
| **Drill-down** | "Walk me through Y" / "Explain Z" | Step-by-step call chain with annotated code refs |
| **Search** | "Where does X happen?" | File + line range with brief context |
| **Decision** | "Why is it built this way?" | Design rationale, tradeoffs, alternatives considered |

---

## Step 0: Locate Entry Points

Before explaining anything, establish orientation:

1. Look for `main`, `__init__`, `index`, `app`, `server`, `run` — whichever fits the stack.
2. Check `README.md` for stated entry points. Check `pyproject.toml`, `package.json`, or equivalent for `[tool.scripts]` / `"scripts"`.
3. Build a quick dependency map: which modules import which.

Produce a one-line orientation statement before diving deeper:
> "This is a Python CLI. Everything starts from `cli.py → main()`. The core logic is in `engine/`, config is in `config.py`."

---

## Explanation Tiers

Deliver in order. Stop when the user signals they have enough.

### Tier 1 — 10-Second Summary
One short paragraph. No jargon unless the user has demonstrated familiarity.
- What does this codebase do?
- Who uses it? (CLI, API, background service, library?)
- One core concept that unlocks everything else.

### Tier 2 — Module Map

```
┌──────────────────────────────────────────────────────────────┐
│  [Entry Point]                                               │
│       │                                                      │
│       ├──▶ [Module A]  ─── purpose in 5 words               │
│       ├──▶ [Module B]  ─── purpose in 5 words               │
│       └──▶ [Module C]  ─── purpose in 5 words               │
└──────────────────────────────────────────────────────────────┘
```

Use actual file/module names. One-line purpose per node. Show data direction with `→`.

### Tier 3 — Call Chain

For a specific flow (e.g., "what happens when a user submits a form?"):

```
user_input
    │
    ▼
handler.handle_request()        [handler.py:42]
    │  validates input via InputSchema
    ▼
service.process()               [service.py:88]
    │  queries DB, applies business rules
    ▼
repo.save()                     [repo.py:31]
    │  writes to PostgreSQL
    ▼
response returned to caller
```

Include file:line references. Annotate *what* each step does, not just *where*.

### Tier 4 — Code Spotlight

Paste the relevant snippet with inline annotations:

```python
def process(self, payload: dict) -> Result:
    # ① Validate — raises ValueError if schema fails
    validated = self.schema.load(payload)

    # ② Business rule: reject if balance would go negative
    if validated.amount > self.account.balance:
        raise InsufficientFundsError(...)

    # ③ Persist atomically — rolls back on any exception
    with self.db.transaction():
        self.repo.debit(self.account, validated.amount)

    return Result.ok(validated)
```

Use numbered comments `①②③` for sequential steps. Never paste unexplained code.

---

## Q&A Mode

When the user asks a targeted question ("what does X do?"):

1. **Find it** — grep for the symbol, locate the definition.
2. **State it** — one sentence answer first.
3. **Show it** — paste the relevant lines with `①②③` annotations.
4. **Connect it** — who calls this? What does it return to?

Format:
> **`process_payment()`** — debits the account and records the transaction.
> Called by: `checkout.submit()` [checkout.py:77]
> Returns: `Result` (success) or raises `InsufficientFundsError`

---

## Design Decision Explanations

When asked "why is it built this way?":

1. State the decision as a sentence.
2. List what it enables (the upside).
3. List what it costs (the tradeoff).
4. Note alternatives that were rejected, if detectable from comments, git history, or `Artifacts/DECISION_LOG.md`.

```
Decision: All DB access goes through Repository classes.
Enables:  Swap storage backends without touching business logic.
Costs:    Extra abstraction layer; more files to navigate.
Rejected: Active Record pattern — couples domain to ORM.
```

---

## What to Avoid

- **Wall-of-code dumps** without annotation — always explain before pasting.
- **Jargon-first** — calibrate to the user's demonstrated level.
- **Starting at the wrong layer** — Tier 1 before Tier 3, always.
- **Guessing at intent** — if code is non-obvious, say so: "This looks like it handles X, but the naming is unclear — worth asking the author."
- **Stale explanations** — always read the actual source file, not cached knowledge.

---

## Offer to Go Deeper

After each explanation tier, prompt:
> "Want me to drill into any part of this? I can walk through a specific call chain, explain a design decision, or search for where something happens."

This keeps explanations collaborative rather than monolithic.
