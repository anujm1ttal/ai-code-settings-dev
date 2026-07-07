---
name: glossary-extraction
description: Extract a DDD-style ubiquitous language glossary from the current conversation, flagging ambiguities and proposing canonical terms. Saves to Artifacts/GLOSSARY.md. Do NOT use for general documentation maintenance or staleness audits — use doc-updater instead; do NOT use for architecture or ADR content — use ARCH.md/DECISION_LOG.md conventions instead.
metadata:
  version: "1.0.1"
  tags: ["glossary", "terminology", "ddd", "ubiquitous-language", "concierge"]
---

# Glossary Extraction (Ubiquitous Language)

Extract and formalize domain terminology from the current conversation into a consistent glossary, saved to the workspace's canonical state.

## Process

1. **Scan the conversation** for domain-relevant nouns, verbs, and concepts.
2. **Identify problems**:
   - Same word used for different concepts (ambiguity).
   - Different words used for the same concept (synonyms).
   - Vague or overloaded terms.
3. **Propose a canonical glossary** with opinionated term choices.
4. **Write to `Artifacts/GLOSSARY.md`** using the format below.
   - **Mirroring Rule [HARD-GATE]**: You MUST perform a mirrored write with `IsArtifact: false` to the absolute workspace path.
5. **Output a summary** inline in the conversation.

## Output Format

Write a `Artifacts/GLOSSARY.md` file with this structure:

```md
# Domain Glossary (Ubiquitous Language)

## [Subdomain Name]

| Term | Definition | Aliases to avoid |
| :--- | :--- | :--- |
| **TermName** | One sentence definition. | Synonym1, Synonym2 |

## Relationships

- A **TermA** [relationship] **TermB**.

## Example Dialogue

> **Dev**: "Contextual question?"
> **Domain Expert**: "Answer using terms precisely."

## Flagged Ambiguities

- "[Term]" was used ambiguously. Recommendation: use **[CanonicalTerm]**.
```

## Rules

- **Be opinionated.** Pick the best term and deprecate others.
- **Flag conflicts explicitly.**
- **Only include domain terms.** Skip generic programming concepts.
- **Keep definitions tight.** One sentence max.
- **Mirroring Requirement**: Always write to `Artifacts/GLOSSARY.md` at the absolute path.
