---
name: architecture
description: High-level design principles focusing on leverage, depth, and modularity. Based on Matt Pocock's "improve-codebase-architecture" patterns.
---

# Architecture Principles

Standard deep-vs-shallow-module design applies (Ousterhout) — no project-specific override.
One rule this repo does add: use **Ubiquitous Language** for naming — if a concept exists in
the domain, it exists in the code *and* in `Artifacts/GLOSSARY.md`. Align seams with domain
boundaries, not implementation convenience.
