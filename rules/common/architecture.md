---
name: architecture
description: High-level design principles focusing on leverage, depth, and modularity. Based on Matt Pocock's "improve-codebase-architecture" patterns.
---

# Architecture Principles

Focus on **deepening opportunities** — refactors that turn shallow modules into deep ones. The goal is testability, locality, and AI-navigability.

## 🧠 Core Mental Models

### 1. Deep vs. Shallow Modules
- **Module**: Anything with an interface and an implementation (function, class, package, slice).
- **Interface**: Everything a caller must know to use the module: types, invariants, error modes, config.
- **Depth (High Leverage)**: A lot of behavior behind a small, simple interface. (e.g., `fs.readFile`)
- **Shallow (Low Leverage)**: An interface nearly as complex as the implementation. (e.g., a pass-through service).

### 2. The Deletion Test
Imagine deleting the module. 
- If complexity **vanishes**, it was a pass-through (shallow).
- If complexity **reappears** across N callers, it was earning its keep (deep).

## 📐 Design Guidelines

- **Locality**: Concentration of change, bugs, and knowledge in one place.
- **Leverage**: What callers get from depth (doing more with less).
- **The interface is the test surface**: Tests should focus on the contract, not the internals.
- **Seams**: Use interfaces to create seams where behavior can be altered without editing in place.
  - One adapter = hypothetical seam.
  - Two adapters = real seam.

## 🛡️ Domain Alignment
- Use **Ubiquitous Language** for naming. If a concept exists in the domain, it must exist in the code (and `Artifacts/GLOSSARY.md`).
- Align seams with domain boundaries.
