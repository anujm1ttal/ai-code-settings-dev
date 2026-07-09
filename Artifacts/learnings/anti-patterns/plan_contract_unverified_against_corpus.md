# Anti-Pattern: Plan Contract Assertions Never Probed Against the Target Corpus

**Captured:** 2026-07-09 (VSE-1) · **Category:** Anti-Pattern

## The Failure Mode

A plan-level contract asserts a checkable property of existing artifacts ("all gold prompts
contain a contrast statement") without anyone grepping the artifacts first. The implementer then
discovers mid-build that the check as specified is **unsatisfiable** — the reference data never
had the property — and must improvise a resolution under a conflicting instruction
("gold must pass" vs "check must exist").

## Evidence (VSE-1)

- Plan D1 specified VP-04: "contrast statement present (≥4.5:1 body / ≥3:1 large)".
- Neither user-authored gold prompt contains any contrast statement (Slide B: zero
  ratio/keyword occurrences). A literal check would permanently fail a gold fixture.
- Coder resolved it well (explicit statement OR structural proxy), but the deviation then cost:
  an audit ruling, an in-source comment correction (the improvised rationale itself overclaimed),
  and a formal plan amendment — all avoidable with one grep at planning time.

## How to Apply

- Before encoding "X is present in corpus Y" as a validator rule or success metric, **probe Y**
  (grep/script) and cite the evidence in the plan.
- Sibling rule: `testing-strategy.md` §"Inherited Triage Is a Hypothesis" — a stated contract is
  a hypothesis until run against reality. This extends it from production behavior to
  reference-data properties.
