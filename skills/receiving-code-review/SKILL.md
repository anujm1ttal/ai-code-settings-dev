---
name: receiving-code-review
description: Use this skill whenever code review feedback arrives — from the auditor, a reviewer subagent, a human reviewer, or an external tool (PR comments, /audit FAIL reports, lint reports). Trigger before responding to or acting on any review finding. Do NOT use when producing a review; that is the reviewer's role (see implementation-dispatch reviewer-prompt).
argument-hint: "<review feedback to process>"
metadata:
  version: "1.0.0"
  tags: [code-review, feedback, auditor-loop, quality]
---

# Skill: Receiving Code Review

## ⚖️ The Iron Law
**FEEDBACK IS EVALUATED AGAINST THE CODEBASE, NOT OBEYED OR PERFORMED AT.**
Review feedback — even from the auditor — is a set of claims to verify, not orders to execute. Blind compliance ships a reviewer's mistake; performative agreement ships nothing.

## 🔁 Response Sequence (in order, no skipping)

1. **READ** the full review before reacting to any single item. Items may be related; partial understanding = wrong implementation.
2. **UNDERSTAND** — restate each finding as a technical requirement in your own words.
3. **VERIFY** — check each claim against codebase reality: does the cited line exist, does the described failure actually occur, is there a reason the current code is the way it is (`git log`/comments)?
4. **EVALUATE** — is the suggested fix technically sound *for this codebase*? Does it break existing behavior, violate `coding-style.md`, or conflict with a documented constraint in `MEMORY_ANCHORS.md`?
5. **RESPOND** — acknowledge confirmed findings tersely; push back on unconfirmed ones with evidence (file:line, test output). If ANY item is unclear, stop and ask about ALL unclear items before implementing ANY item.
6. **IMPLEMENT** — one finding at a time, each through the `test-driven-development` loop, each verified before the next.

## 🚫 Forbidden Responses
- "You're absolutely right!" / "Great point!" / "Excellent feedback!" — performative agreement is banned. The corrected code demonstrates you listened.
- "Let me implement that now" before step 3 (VERIFY) has happened.
- Implementing half the findings while others are still ambiguous.
- Silently dropping a finding you disagree with — push back explicitly or fix it.

**Correct form when a finding is valid**: `Fixed. <what changed> (<file:line>)` or `Good catch — <issue>. Fixed in <location>.`
**Correct form when it isn't**: `Not applied: <evidence>. <reasoning>.`

## 🧐 External / Automated Feedback
For feedback from outside the project (PR bots, external reviewers, style tools), additionally check:
- Does the reviewer have full context (platform constraints, Rhino 3.9 runtime, project.json type)?
- **YAGNI check**: if a reviewer requests supporting an unused case, grep first. If nothing calls it, propose removal over implementation.

## 🚫 Anti-Rationalization Table

| Excuse | Reality |
| :--- | :--- |
| "The auditor said so, so it must be right." | Auditors misread code too. Verify the claim; a wrong fix fails the next audit anyway. |
| "Agreeing enthusiastically builds rapport." | It spends tokens and signals nothing. Evidence builds trust. |
| "I'll fix the clear items now, ask about the rest later." | Related items fixed separately produce contradictory patches. Clarify all, then fix. |
| "Pushing back looks defensive." | Unfounded compliance is the actual failure mode. Push back WITH evidence, comply WITHOUT ego. |

## 🔗 Relationships
- **Rejection loop**: On 2nd auditor rejection, `orchestration.md` mandates a skill-file review — this skill is that review's checklist.
- **Fix discipline**: Every accepted finding is implemented via `test-driven-development`.
- **Evidence**: Pushback and fix claims both follow `verification-gate` standards.
