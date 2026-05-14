# Anthropic Skills Analysis: Lessons for the Agent OS

## Executive Summary

17 skills reviewed from Anthropic's official repository. These range from production document-creation skills (docx, pdf, pptx, xlsx) to creative/design skills (algorithmic-art, canvas-design, frontend-design) to developer tooling (mcp-builder, webapp-testing, skill-creator, claude-api). The analysis below extracts **architectural patterns, writing techniques, and operational ideas** directly applicable to your Agent OS.

---

## 🏗 Structural Patterns Worth Adopting

### 1. Progressive Disclosure (Three-Level Loading)

Anthropic's `skill-creator` explicitly documents a three-tier context-loading model:

| Level | What Loads | Size Target |
|:---|:---|:---|
| **L1: Metadata** | `name` + `description` frontmatter | ~100 words, always in context |
| **L2: SKILL.md body** | Instructions, examples, guidelines | <500 lines |
| **L3: Bundled resources** | scripts/, references/, assets/ | Unlimited, loaded on demand |

**Implication for your OS**: Your skills are currently flat — the entire SKILL.md loads when triggered. Adopting L3 (bundled `references/` files with clear pointers) would reduce context pressure for heavier skills like `python-rhino-grasshopper` and `typescript-mcp`.

### 2. "Pushy" Descriptions for Trigger Accuracy

Anthropic explicitly advises making skill descriptions **aggressively inclusive** to combat under-triggering:

> *"Instead of 'How to build a simple fast dashboard', write 'How to build a simple fast dashboard... Make sure to use this skill whenever the user mentions dashboards, data visualization, internal metrics, or wants to display any kind of company data, even if they don't explicitly ask for a dashboard.'"*

**Implication**: Your skill descriptions are currently terse and professional. Consider expanding trigger-keywords in descriptions — especially for skills like `systematic-debugging` and `verification-gate` that should fire more often.

### 3. Decision Trees Over Prose

`webapp-testing`, `mcp-builder`, and `claude-api` all use **ASCII decision trees** to route behavior:

```
User task → Is it static HTML?
    ├─ Yes → Read HTML file directly
    └─ No → Is the server already running?
        ├─ No → Use with_server.py
        └─ Yes → Reconnaissance-then-action
```

**Implication**: Your skills use bullet lists and tables for routing. Decision trees are more scannable for branch logic — consider adopting them for `systematic-debugging` and `rhino-e2e-testing`.

### 4. Scripts as Black Boxes

`webapp-testing` has a critical pattern: **"Always run scripts with `--help` first. DO NOT read the source."**

This treats bundled scripts as opaque tools with CLI interfaces, preserving context window space. The model calls them, doesn't internalize them.

**Implication**: Your skills don't bundle executable scripts. For heavy workflows (e.g., PowerPoint generation, Rhino testing), bundling reusable scripts with `--help` interfaces would reduce token waste from the model reinventing the same helper code each session.

---

## ✍️ Writing & Tone Patterns

### 5. "Explain the Why" Over "MUST/NEVER"

The `skill-creator` explicitly pushes back on rigid imperative language:

> *"If you find yourself writing ALWAYS or NEVER in all caps, or using super rigid structures, that's a yellow flag — reframe and explain the reasoning so the model understands why."*

**Implication**: Your `coding-style.md` is heavy on MUSTs and NEVERs. This is fine for hard rules (security, immutability), but for stylistic guidance, Anthropic's approach of explaining *why* would likely produce better compliance. Consider a pass to soften non-critical directives.

### 6. Conversational Calibration

`skill-creator` explicitly handles **audience awareness**:

> *"There's a trend where plumbers open up terminals, parents and grandparents google 'how to install npm'... Pay attention to context cues."*

**Implication**: Your system assumes a technical user throughout. This is correct for your use case, but the principle of calibrating communication to the specific user is worth noting for any future multi-user deployment.

### 7. Imperative Form for Instructions

> *"Prefer using the imperative form in instructions."*

Your rules already do this well. Confirmed as best practice.

---

## 🔄 Workflow Patterns

### 8. Eval-Driven Iteration Loop

`skill-creator` defines a rigorous **create → test → review → improve** cycle with:
- Parallel baseline + with-skill runs
- Quantitative assertions + qualitative human review
- An HTML viewer for side-by-side comparison
- Feedback JSON schema for structured iteration

**Implication**: Your `/audit` command is a one-shot gate. Anthropic's approach of **iterative eval loops with structured feedback** is more rigorous. Consider whether your `verification-gate` skill could adopt a similar "run N times, compare, iterate" pattern for critical skills.

### 9. Reader Testing (Sub-Agent Verification)

`doc-coauthoring` has a brilliant Stage 3: **test the document with a fresh Claude (no context)** to catch blind spots. This is essentially a "clean-room review" — the document must stand on its own.

**Implication**: Your `/audit` could adopt this. After a plan or document is written, spawn a sub-agent with ONLY the artifact — no conversation context — and ask it to evaluate. This catches assumptions that leaked from the session.

### 10. QA as Bug Hunt, Not Confirmation

`pptx` skill explicitly states:

> *"Assume there are problems. Your job is to find them. If you found zero issues on first inspection, you weren't looking hard enough."*

**Implication**: Your auditor agent should adopt this adversarial mindset explicitly. Consider adding this framing to `agents/auditor.md`.

### 11. Subagent Visual QA

`pptx` mandates using **subagents for visual inspection** even for 2-3 slides, because "You've been staring at the code and will see what you expect, not what's there."

**Implication**: For your PPTX and visual projects, the creative-director or auditor should delegate visual QA to a fresh subagent to avoid confirmation bias.

---

## 🎨 Design & Aesthetics Patterns

### 12. Anti-"AI Slop" Design Principles

`frontend-design` and `web-artifacts-builder` both explicitly combat generic AI aesthetics:

> **Banned**: Inter, Roboto, Arial, system fonts, purple gradients on white backgrounds, predictable layouts

> **Required**: Distinctive typography, bold aesthetic commitment, unexpected spatial composition, depth through textures/gradients

**Implication**: Your `visual-composition` skill and creative-director agent could adopt these concrete anti-patterns. "Avoid AI slop" is more actionable when you list the specific clichés to avoid.

### 13. Design Philosophy Before Implementation

`canvas-design` and `algorithmic-art` both require a **written design philosophy** (4-6 paragraphs) before any implementation. The philosophy defines the aesthetic movement, then the code expresses it.

**Implication**: Your creative-director's `LAYOUT_SPEC.md` serves a similar purpose but is more structural. Consider whether a short "design philosophy" section in the spec would improve aesthetic coherence.

### 14. Color Palette Specificity

`pptx` provides **10 named palettes with hex codes**, not generic advice. e.g., "Midnight Executive: `1E2761` navy, `CADCFC` ice blue, `FFFFFF` white."

**Implication**: Your visual-composition skill should include concrete palette options rather than abstract guidance like "use harmonious colors."

---

## 🔧 Technical Patterns

### 15. Template-First Development

`algorithmic-art` and `web-artifacts-builder` enforce a **"read the template, modify the variable parts"** approach. The template is the literal starting point — not inspiration.

**Implication**: Your `powerpoint-patterns` skill should consider shipping a canonical template that the model extends rather than generating from scratch each time.

### 16. Seeded Reproducibility

`algorithmic-art` enforces `randomSeed(seed)` for all generative work — same seed always produces identical output.

**Implication**: Worth noting for any generative/parametric geometry work in your Rhino pipeline.

### 17. Document Format Mastery

The `docx`, `xlsx`, `pptx`, and `pdf` skills are **deeply technical** — they document XML schemas, DXA units, formula recalculation scripts, tracked-change XML patterns, and cross-platform rendering bugs. These aren't "how to use a library" — they're **domain-complete references**.

**Implication**: Your `powerpoint-patterns` skill should aspire to this level of depth. Anthropic's pptx skill covers everything from color palettes to QA workflows to conversion scripts — it's a single source of truth.

---

## 📊 Comparison: Your Skills vs. Anthropic's

| Dimension | Your Agent OS | Anthropic Skills | Gap |
|:---|:---|:---|:---|
| **Structure** | Flat SKILL.md | 3-level progressive disclosure | Adopt L3 references/ |
| **Descriptions** | Professional, terse | "Pushy", keyword-rich | Expand trigger surfaces |
| **Routing** | Tables + bullets | Decision trees | Adopt for branch logic |
| **Bundled Scripts** | None | Black-box CLIs with `--help` | High-value addition |
| **Tone** | Heavy on MUSTs | "Explain the why" | Soften non-critical rules |
| **Eval Loops** | One-shot `/audit` | Iterative with HTML viewer | Consider for critical skills |
| **Visual QA** | Manual | Subagent delegation | Adopt for PPTX/visual |
| **Anti-Slop** | Implicit | Explicit banned patterns | List concrete anti-patterns |
| **Templates** | Generated from scratch | Literal starting-point files | Ship canonical templates |

---

## 🎯 Recommended Actions (Prioritized)

1. **Expand skill descriptions** with trigger keywords — cheapest win for activation accuracy
2. **Adopt progressive disclosure** (L3 `references/`) for heavy skills to reduce context pressure
3. **Add "Assume bugs exist" framing** to the auditor agent definition
4. **Bundle reusable scripts** with `--help` interfaces for repetitive workflows
5. **Ship concrete anti-slop patterns** in visual-composition (banned fonts, banned layouts)
6. **Add decision trees** to routing-heavy skills (systematic-debugging, webapp-testing)
7. **Consider reader-testing pattern** (fresh sub-agent, no context) for plan/doc verification
