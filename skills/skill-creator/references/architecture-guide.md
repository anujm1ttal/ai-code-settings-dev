# Skill Architecture & Writing Guide

## Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic/repetitive tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Files used in output (templates, icons, fonts)
```

## Progressive Disclosure

Skills use a three-level loading system:
1. **Metadata** (name + description) - Always in context (~100 words).
2. **SKILL.md body** - In context whenever skill triggers (<500 lines ideal).
3. **Bundled resources** - As needed (unlimited, scripts can execute without loading).

**Key patterns:**
- Keep SKILL.md under 500 lines.
- Reference files clearly from SKILL.md with guidance on when to read them.
- For large reference files (>300 lines), include a table of contents.

**Domain organization**:
```
cloud-deploy/
├── SKILL.md (workflow + selection)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

## Writing Patterns

- **Imperative form**: Use "Do X", "Create Y".
- **Explain the "Why"**: Theory of mind is powerful; explain reasoning over heavy MUSTs.
- **Output templates**: Explicitly define required structures.
- **Examples**: Use Input/Output pairs to clarify expected behavior.
