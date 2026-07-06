---
description: Visualize skill dependency graphs, identify clusters, and recommend skill combinations. Shows which skills work together and which are isolated. Owned by the strategist for routing optimization.
argument-hint: "[--export]"
---

# Command: /skill-graph

Owned by the **strategist**. Analyzes skill relationships and generates dependency graphs for better routing recommendations.

## Execution Sequence

1. **Load Registry**: Read all skills from `skills/` and extract metadata (tags, descriptions, project types).
2. **Build Graph**: Connect skills based on:
   - Shared tags (strong affinity within a domain)
   - Shared project type defaults (co-activation pattern)
   - Cross-references in descriptions (explicit dependencies)
3. **Cluster Analysis**: Group skills by domain (tag clusters).
4. **Project Affinities**: Map which skills naturally pair per project type.
5. **Identify Patterns**:
   - **Universal Skills** (3+ project types): always loaded
   - **Singletons** (1 project type only): candidates for archival
   - **Strongest Pairs** (high co-occurrence): activate together
6. **Generate Reports**: Markdown summary + ASCII visualization.
7. **Export** (if `--export`): Write to `Artifacts/Temp/` for audit trail.

## Report Format

**Header**:
- Total skill count
- Tag cluster count
- Universal vs. singleton breakdown

**Skill Clusters (by Tag)**:
```
- [tag]: [skill-1], [skill-2], [skill-3]
```

**Project Affinities**:
```
- [project-type] (N skills):
  ★ [universal-skill]
  • [specialized-skill]
```

**Strongest Skill Pairs**:
```
- `skill-a` ↔ `skill-b` (strength: 7)
  (shared 2 tags + 2 projects + cross-ref)
```

**ASCII Visualization**:
```
[PROJECT_TYPE]
  ★ skill-that-appears-in-3+-projects
  • skill-that-appears-in-1-project
```

**Routing Recommendations**:
- "Bundle these N singletons into optional archive"
- "Pre-activate these N universal skills for all projects"
- "Consider this skill pairing for [project-type]"

## Strength Calculation

Connection strength between two skills is computed as:
- **Shared tags**: +2 per tag
- **Shared project defaults**: +3 per project type
- **Cross-reference in description**: +1 per mention

Example:
- `python-mcp` + `typescript-mcp`: shared tag `mcp` (+2), shared projects `code` (+3) = **5**
- `youtube-strategy` + `youtube-scriptwriting`: shared tag `youtube` (+2), shared projects `youtube` (+3) = **5**

## When to Use

- Session start (understand skill landscape)
- Before reducing skills (visualize impact of deletions)
- When designing new project types (see coverage gaps)
- Pre-`/handoff` (document skill relationships for next session)

## Arguments

- **`--export`**: Write reports to `Artifacts/Temp/` for audit trail

## Boundaries

Does NOT: delete skills, execute code.

**Authority**: Strategist owns routing. May recommend skill bundling or consolidation, but implementation requires `/graduate` approval.

## Integration with Other Commands

- **`/blueprint`**: Strategist reviews graph during Step 0 to plan skill coverage
- **`/sync`**: Can call `/skill-graph` to refresh understanding after registry changes
- **`/graduate`**: When moving a singleton to optional archive, document here first

## Example Output

```
# Skill Dependency Graph

**Total Skills**: 28
**Tag Clusters**: 14
**Universal Skills**: 7
**Singletons**: 5

## Skill Clusters (by Tag)
- **youtube** (3): youtube-strategy, youtube-scriptwriting, youtube-retention
- **rhino** (4): python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing, cd-foundations
- **mcp** (2): python-mcp, typescript-mcp
...

## Universal Skills (3+ project types)
- `codebase-navigator` (code, geometry, data, manuscript, hybrid)
- `systematic-debugging` (code, geometry, data, pbi-report, hybrid)
- `implementation-dispatch` (all)
...

## Strongest Skill Pairs
- `python-mcp` ↔ `typescript-mcp` (strength: 7)
- `youtube-strategy` ↔ `youtube-scriptwriting` (strength: 5)
- `rhino-e2e-testing` ↔ `python-rhino-grasshopper` (strength: 6)
...

## Recommendations
- Consider bundling 5 singleton skills into optional archives
- High tag diversity (14 tags) — consider consolidation
- 7 universal skills found — consider preloading for all projects
```
