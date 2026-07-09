# Pattern: When Shipping a Validator, Sweep ALL Exemplar Content Through It

**Captured:** 2026-07-09 (VSE-1) · **Category:** Pattern

## The Lesson

When a phase ships an executable validator for some output format, run it against **every piece
of exemplar/teaching content that ships alongside it** — worked examples, templates, tutorials —
not just the designated gold fixtures the plan names.

## Evidence (VSE-1)

- Plan gated `validate_prompt.py` on the 2 gold prompts in `reference-slides.md` only. Both passed.
- The T5 live-fire (a fresh emission modeled on templates' Example 3) failed exit 1 → exposed that
  **Example 3 itself** failed VP-01 (3 sections).
- Sweeping the remaining examples then found **Example 2 failing too** — including a real
  `palette.neutrals` token leak (VP-02) sitting in the skill's own teaching material, undetected
  by two audits because nobody had pointed the validator at it.
- Example 1 passed. 2 of 3 shipped exemplars violated the rules the skill teaches.

## How to Apply

- Phase plans that add validators should include a "self-sweep" metric: all shipped
  examples/templates in the same skill/module pass the new validator, not just gold fixtures.
- Teaching material is output too. If the pipeline gates every emission, exemplars that agents
  imitate must pass the same gate, or the skill ships a broken-by-default path.
