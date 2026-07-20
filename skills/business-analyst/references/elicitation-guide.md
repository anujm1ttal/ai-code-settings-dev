# Requirements Elicitation Methodology

Two modes, never both in one run. Default `/blueprint` → §1 breadth sweep (bounded, 3–5 questions).
`/blueprint --interview` → §2 depth traversal (unbounded, exits on §5), which **replaces** the sweep.

## 1. Breadth Sweep — default, bounded

High-density questions the `strategist` asks before Step 0 to eliminate "Requirement Debt". Use when the user can already state the idea — the sweep *confirms* scope, it does not extract it.

### 1. The "Why Now" (Urgency)
- "What happens if we *don't* build this today? What is the cost of doing nothing for another month?"
- "Is this a response to a recent failure, a new mandate, or a long-standing inefficiency?"

### 2. The "Minimum Viable Win" (Minimalism)
- "If I could only deliver ONE feature from your list, which one makes the project a success? What can we strictly ignore for Phase 1?"
- "What is the absolute manual workaround we must beat to be useful?"

### 3. The "Work Flow Insertion" (Operational)
- "At what exact moment in your day do you open this tool? What data is in your hand (or on your screen) right then?"
- "Who is the first person to see the output of this tool, and what do they do with it?"

### 4. The "Blast Radius" (Risk)
- "If this tool produces a 5% error in its calculation, who gets fired / what breaks / how much money is lost?"
- "Are there any 'black box' dependencies or external approvals we don't control?"

**Standard**: Ask 3 questions from this list (or domain-specific variants) to anchor the Step 0 VALUE_CHECK.

## 2. Depth Traversal — `--interview`, unbounded

- **Order by constraint, not category.** Ask the decision that constrains the most downstream options first. The §1 categories are a coverage checklist, never a sequence.
- **One question per turn.** Wait for the answer; each answer re-orders the remaining tree. Never batch. Prefer AskUserQuestion when the options are enumerable.
- **Prune aloud.** When an answer kills a branch, name the questions it made unnecessary.

## 3. Codebase-First Gate [R2]

- **If the repo can answer it, read instead of asking — budget ≤2 tool calls per question.** Over budget → stop exploring and ask the user.
- Report what you found and what it settled; never re-ask a settled question.

## 4. Recommendation Protocol [R3]

Every question ships a recommended answer, so anchoring is the failure mode this section prevents — the user must be able to see how hard to push back.

- **Tag every recommendation** `[HIGH]`/`[MED]`/`[LOW]` with its basis: evidence read, inference, or
  guess. Presenting a `[LOW]` guess in the register of a `[HIGH]` finding is forbidden.
- **Preference calls get NO recommendation.** If the answer turns on the user's taste, habit, or
  priorities rather than a fact, name the tradeoff and take no side — the boundary in `standards.md`
  §Intellectual Honesty (pressure-test claims, not preference calls) applies here too.

## 5. Termination [R1]

Not question count — exit only on a **signed restatement** the user accepts:
1. Problem statement, 1–3 sentences, in the user's framing.
2. Resolved decisions, each with the answer that settled it.
3. Explicitly unresolved → carried into Step 0 RISKS.

**Checkpoint every 5 questions**: emit the current restatement, ask "more, or proceed to Step 0?" The restatement feeds Step 0 directly — do not re-interview.

## 6. Worked Traversal (dependency-ordered)

Idea: *"something to help me reuse Rhino test harnesses across projects."*

| # | Question | Why asked here | Unlocks |
|:--|:---|:---|:---|
| Q1 | Skill, template, or runnable package? | Constrains every downstream answer — install path, versioning, who edits it | Q2, Q3, Q4 |
| Q2 | *(skill)* Carries executable harness code, or prose + snippets only? | Decides whether packaging/deploy exists at all | Q3 |
| Q3 | *(prose)* New skill, or a reference under `rhino-e2e-testing`? | Single-owner rule; sets registry blast radius | Q4 |
| Q4 | *(reference)* Which project types route to it? | Last — meaningless until the host skill is fixed | — |

Q1's answer ("skill") killed the entire packaging subtree unasked. That is the point: resolve the constraining decision first and most of the tree is never walked.
