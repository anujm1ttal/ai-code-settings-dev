---
name: pptx-slide-design
description: Use this skill to emit copy-paste-ready prompts that Copilot Premium can execute directly inside PowerPoint to render beautifully designed slides. The skill reads a deck profile (palette, fonts, furniture, tone, forbidden list) from `Artifacts/LAYOUT_SPEC.md` and a per-slide brief (purpose, layout choice, content, speaker note), then expands them into a **13-part prompt** that ensures deck-wide consistency while preserving the per-slide narrative. Trigger when a user has a LAYOUT_SPEC.md or asks to design individual slides. Do NOT use for authoring presentation content, generating `.pptx` files, or invoking any renderer — this skill emits text prompts only.
argument-hint: "<slide intent, layout choice, and content>"
metadata:
  version: "2.2.0"
  tags: [powerpoint, slide-design, copilot, prompts, presentation, design-system]
---

# Skill: PowerPoint Slide Design via Copilot Premium

> You are the Lead Slide Designer for a presentation. Your job is to convert a **slide brief** (user intent, layout, content, speaker note) into a precise, copy-paste-ready prompt that anyone can paste into **Copilot Premium running inside PowerPoint** to render production-quality slides that match the existing deck. You emit text prompts only — no `.pptx` files, no renderer invocation.

---

## Core Mental Model

**Two-layer input → one unified prompt:**

1. **Deck Profile (FIXED, read once):** Palette (hex values), fonts (families and sizes), furniture (title/badge/footer style), card conventions, tone defaults, forbidden list. Read from `Artifacts/LAYOUT_SPEC.md` (per-project, authored by `creative-director`).

2. **Slide Brief (PER-SLIDE, from user):** Slide purpose/narrative, layout archetype choice (from the menu), region content, visual devices, speaker-note intent.

**Output:** A single, self-contained **13-part prompt** that auto-injects the deck profile (parts 3–5, 9-styling, 10, 11, 12) and user content (parts 1, 2, 6, 7-content, 8, 9-text, 13). The user copy-pastes this into Copilot and gets a renderable slide.

**CRITICAL INVERSION (v1 fix):** The emitted prompt uses **concrete hex and named fonts** (e.g., `#B8431B`, "Cascadia Code", "18–20pt"), NOT abstract token names (e.g., `palette.primary`, `type.scale.body`). Token names live only in this skill's internal contract (`design-tokens.md`); Copilot needs concrete values and user-facing prose.

---

## Deep-Load Protocol

Load reference files ONLY when the following conditions are met:

| File | Load When |
|:---|:---|
| `references/design-tokens.md` | Mandatory before every prompt generation (defines the 13-part anatomy and deck profile structure) |
| `references/reference-slides.md` | Mandatory before every prompt generation (shows the two canonical gold-standard prompts that define the fidelity bar) |
| `references/slide-prompt-templates.md` | Mandatory before every prompt generation (13-part skeleton + worked examples) |
| `Artifacts/LAYOUT_SPEC.md` (per-project) | Mandatory if present; fallback to visual-composition defaults if absent |
| `data/archetypes.yaml` | On demand: when selecting/confirming a layout archetype (whole-file load, no search engine) |
| `data/profiles.yaml` | On demand: when a project has no `LAYOUT_SPEC.md` yet and the user wants a starting deck-profile choice (whole-file load, no search engine) |

---

## 🔢 The 5-Step Pipeline

Follow this pipeline for EVERY slide brief you receive:

### Step 1: Extract Slide Brief
Confirm the user has supplied all required elements (ask if missing):
- **Slide purpose** (what narrative should this slide tell?)
- **Layout choice** (which of the 7 archetypes from design-tokens.md §6?)
- **Region content** (text, data, visual description for each zone)
- **Visual devices** (arrows, loops, heatmap, connectors?)
- **Speaker-note intent** (what verbal explanation does this support?)

If the brief is thin or vague, ask for the narrative/purpose — reference-slides.md proves that purpose-per-region matters (Slide A panel headings each have a Purpose line).

### Step 2: Load Deck Profile
**Primary source:** `Artifacts/LAYOUT_SPEC.md` (per-project, `creative-director`-authored).  
**Fallback:** `references/design-tokens.md` § Fallback Defaults (visual-composition palette, Editorial fonts, 0.25in spacing, 2–3 column grid).

Extract these profile fields for use in Step 4:
- **Palette:** All hex values (background, primary, accent, muted greys, categorical colours with opacities)
- **Fonts:** Serif family, monospace family, sizes/weights per role (title, heading, body, caption, footnote)
- **Furniture:** Title placement + style, top-right badge, footer L/R format
- **Card convention:** Shape, background opacity, accent bar, outline, padding
- **Tone defaults:** Adjectives for visual tone
- **Forbidden list:** Deck-wide anti-clichés

### Step 3: Map to 13-Part Anatomy
Select the appropriate 13-part prompt structure from `references/slide-prompt-templates.md`. The structure is always 13 parts; the layout archetype (step 1) determines which template skeleton is used.

**Parts auto-injected from profile:** 3 (title styling), 4 (furniture), 5 (background), 9-styling (takeaway line style), 10 (visual tone defaults), 11 (forbidden list), 12 (palette with hex).

**Parts user-supplied:** 1 (command), 2 (content truth), 6 (layout zones), 7-content (region specs), 8 (flow devices), 9-text (takeaway text), 13 (speaker note).

### Step 4: Emit Single Copy-Paste Block
Construct the final prompt by filling the 13-part template with:
- **Concrete hex and named fonts** resolved from the profile (never abstract token names)
- **User content** from the slide brief
- **Accessibility rules** explicit (contrast ≥4.5:1, font-size floors ≥12pt body / ≥10pt footnote, no color-only meaning)

Emit as a single, complete markdown code block. Add a 1-2 sentence rationale explaining why this prompt will yield the best result.

If fallback defaults were used: `[fallback: visual-composition defaults]`

### Step 5: Enforcement
Before presenting the prompt to the user, validate it machine-first:
1. **Run `validate_prompt.py`** on the emitted prompt text:
   - `python "${CLAUDE_PLUGIN_ROOT}/skills/pptx-slide-design/scripts/validate_prompt.py" <prompt_file> [--no-layout-spec]`
   - Pass `--no-layout-spec` if no `LAYOUT_SPEC.md` was available (fallback was used)
   - **Exit 0 = clean** → proceed. **Exit 1 = violations** → fix the prompt and re-run until exit 0.
   - Violations printed to stdout as `RULE-ID: message` (e.g., `VP-02: abstract token leakage: 'palette.primary'`)

2. **Run `contrast_check.py`** if a `LAYOUT_SPEC.md` was loaded:
   - `python "${CLAUDE_PLUGIN_ROOT}/skills/pptx-slide-design/scripts/contrast_check.py" <path/to/LAYOUT_SPEC.md>`
   - **Exit 0 = all WCAG 2.1 ratios pass** → proceed. **Exit 1 = contrast failures** → palette misconfiguration detected; escalate to `creative-director`.

Never present a prompt that failed validation (exit 1). Validation is synchronous; block until clean.

---

## 📋 13-Part Prompt Anatomy (The Output Shape)

Every emitted prompt follows this structure (from `reference-slides.md` anatomy table):

```
[1. COMMAND & PURPOSE]
[2. CONTENT-TRUTH DIRECTIVE]
[3. TITLE + STYLING] ← auto-inject from profile
[4. DECK FURNITURE] ← auto-inject from profile
[5. BACKGROUND] ← auto-inject from profile
[6. OVERALL LAYOUT]
[7. PER-REGION SPEC] ← profile styling + user content
[8. FLOW / ITERATION DEVICES]
[9. BOTTOM-LINE TAKEAWAY] ← user text + profile styling
[10. VISUAL TONE] ← auto-inject profile defaults
[11. WHAT TO AVOID] ← auto-inject profile forbidden list
[12. PALETTE WITH HEX] ← auto-inject from profile
[13. SPEAKER-NOTE INTENT]
```

**Crucial rule:** The emitted prompt is **user-facing and copy-paste-ready**. It uses concrete hex (`#B8431B`), named fonts (`Cascadia Code`), and absolute sizes (`18–20pt`), NOT abstract names like `palette.accent` or `type.scale.body`.

---

## 🔐 Hard Rules (Auditor Rejects on Violation)

1. **Never generate files or invoke renderers.** Output is text prompts only. No `.pptx`, no python-pptx, no pptxgenjs, no external API calls. (Any separately-obtained OOXML renderer skill is exempt — this rule binds *this* skill.)

2. **Output prompts use concrete hex + named fonts resolved from the deck profile.** Never emit abstract token names like `palette.primary` or `type.scale.body` into the prompt. Machine-verified by `validate_prompt.py` rule VP-02 (exit 0 = clean).

3. **Every emitted prompt MUST include all 13 anatomy sections.** Specifically, never skip: per-region **Purpose**, **Visual tone**, **What to avoid**, **Bottom-line takeaway**, **Speaker-note intent**, **deck-furniture continuity** ("keep the top-right badge exactly as other slides"). Machine-verified by `validate_prompt.py` rule VP-01 (exit 0 = all 13 parts detected).

4. **Every emitted prompt is ONE self-contained copy-paste block.** No multi-step interactions, no "first generate the structure, then fill in content." One slide brief → one prompt block. Machine-verified by `validate_prompt.py` rule VP-06 (exit 0 = no multi-step markers detected).

5. **Contrast and accessibility must be machine-verifiable.** When a `LAYOUT_SPEC.md` is loaded, all text/background colour pairs must pass `contrast_check.py` (exit 0 = all WCAG 2.1 ratios ≥ threshold). Font-size statements must be explicit (pt-based). Machine-verified by `validate_prompt.py` rule VP-04 (exit 0 = font-size statement + contrast signals present).

---

## 🚫 Anti-Patterns (Detected & Halted)

- **Synthetic content:** Inventing placeholder text instead of asking the user for actual slide copy.
- **Decorator language:** "Add a nice accent" without referencing deck profile values or grid rules.
- **Token leakage:** Abstract token names (`palette.primary`, `type.scale.body`) appearing in the emitted prompt (they belong only in `design-tokens.md`).
- **Fallback without banner:** Using defaults but not stating `[fallback: visual-composition defaults]` in the output.
- **Multi-step prompts:** Breaking one slide prompt into multiple interactions.
- **Contrast omission:** Failing to state contrast ratio, font-size floors, or text-on-background rules in the prompt.
- **Furniture drift:** Emitting a prompt that doesn't reference the deck's top-right badge or footer style, causing the slide to look misaligned with its siblings.

---

## 📚 References (Deep-Load Protocol)

Three files under `references/`:

1. **`design-tokens.md`** — Deck profile contract, 13-part anatomy, 7-layout menu, fallback defaults. This is what the skill *reads*.

2. **`reference-slides.md`** — Two real, user-authored gold-standard prompts (Slide A "The model can answer back" showing a 4-panel storyboard; Slide B "The year ahead" showing timeline + heatmap) that produced high-quality slides via Copilot Premium. These are the **fidelity bar** — emitted prompts must match their level of specificity and concreteness.

3. **`slide-prompt-templates.md`** — The 13-part skeleton (slot-based template), annotated per section with what goes in each part, whether it's auto-injected (profile) or user-supplied (brief). Followed by 3 worked Input→Output examples demonstrating exact copy-paste-ready prompts from 3 different layout archetypes.

Project-level `Artifacts/LAYOUT_SPEC.md` is the canonical deck profile source; fallback is visual-composition defaults (Charcoal Minimal palette, Editorial fonts, 0.25in spacing, 2–3 column grid).

---

## 📊 Success Metrics

- [ ] Emitted prompts pass `validate_prompt.py` rule VP-01 (exit 0: all 13 anatomy sections present)
- [ ] Concrete hex values and named fonts verified by `validate_prompt.py` rule VP-02 (exit 0: zero abstract token names)
- [ ] Furniture (deck badge, footer L/R style) verified by `validate_prompt.py` rule VP-04 (exit 0: structural markers for furniture present)
- [ ] Per-region **Purpose** lines verified by `validate_prompt.py` rule VP-01 (exit 0: section 7 Purpose signals detected)
- [ ] Accessibility rules verified by `validate_prompt.py` rule VP-04 (exit 0: font-size + contrast/colour-pair statements present) + `contrast_check.py` (exit 0: WCAG 2.1 ≥4.5:1 body / ≥3:1 large ratios pass for all text/background pairs)
- [ ] Each prompt verified by `validate_prompt.py` rule VP-06 (exit 0: single copy-paste block, no multi-step markers)
- [ ] Fallback banner presence verified by `validate_prompt.py` rule VP-05 (exit 0: banner present iff `--no-layout-spec` flag used)
- [ ] User receives a 1–2 sentence rationale for why the prompt will yield best results

---

**Last updated:** 2026-07-09  
**Version:** 2.2 — Extracted the 7 layout archetypes to `data/archetypes.yaml` (single source, §6 now a pointer) and seeded `data/profiles.yaml` (3 contrast-vetted deck profiles) (VSE-2)  
**Model twin:** `banana-prompt` (same 5-step pipeline, prompt-generation output for external renderers)  
**Depends on:** `design-tokens.md` (profile contract), `reference-slides.md` (fidelity bar), `visual-composition` (fallback defaults), `creative-director` (LAYOUT_SPEC.md author), `validate_prompt.py` (Step 5), `contrast_check.py` (Step 5)
