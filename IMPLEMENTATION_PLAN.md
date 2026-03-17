# YouTube Integration Implementation

Add a "youtube" capability to the AI settings. This allows users to conceptualize, script, and package YouTube videos using the existing agent fleet.

## User Review Required

- **Agent Choice**: Capability implemented by extending existing agents (`strategist`, `scribe`, `auditor`) with new skills (`youtube-strategy`, `youtube-scriptwriting`, `youtube-retention`) rather than creating new agents.
- **Trigger**: New `/ideate`, `/script`, and `/pack` commands added to the fleet.

## Proposed Changes

### [Core]
#### [NEW] [youtube-strategy](file:///c:/Users/44547/source/repos/ai-code-settings/skills/youtube-strategy/SKILL.md)
Rules for YouTube video packaging, including Title phrasing, Thumbnail visual descriptions, and SEO constraints.

#### [NEW] [youtube-scriptwriting](file:///c:/Users/44547/source/repos/ai-code-settings/skills/youtube-scriptwriting/SKILL.md)
Rules for YouTube A/V script formatting, active voice, and writing for the spoken word.

#### [NEW] [youtube-retention](file:///c:/Users/44547/source/repos/ai-code-settings/skills/youtube-retention/SKILL.md)
Audit gates for viewer retention, pacing, hook strength, and visual variety in scripts.

#### [NEW] [ideate.md](file:///c:/Users/44547/source/repos/ai-code-settings/commands/ideate.md)
Slash command for the strategist to generate video concepts.

#### [NEW] [script.md](file:///c:/Users/44547/source/repos/ai-code-settings/commands/script.md)
Slash command for the scribe to write the A/V script.

#### [NEW] [pack.md](file:///c:/Users/44547/source/repos/ai-code-settings/commands/pack.md)
Slash command for the scribe to generate upload metadata.

### [Fleet Configuration]
#### [MODIFY] [scribe.md](file:///C:/Users/44547/source/repos/ai-code-settings/agents/scribe.md)
Updated to support **Script** and **Pack** modes.

#### [MODIFY] [auditor.md](file:///C:/Users/44547/source/repos/ai-code-settings/agents/auditor.md)
Updated to include YouTube retention audit gates.

#### [MODIFY] [orchestration.md](file:///C:/Users/44547/source/repos/ai-code-settings/rules/common/orchestration.md)
Updated project routing table to include `youtube`.

#### [MODIFY] [CLAUDE.md](file:///C:/Users/44547/source/repos/ai-code-settings/CLAUDE.md) / [GEMINI.md](file:///C:/Users/44547/source/repos/ai-code-settings/GEMINI.md)
Updated quick-reference tables and architecture notes.

#### [MODIFY] [cheatsheet.md](file:///C:/Users/44547/source/repos/ai-code-settings/cheatsheet.md)
Updated to include new commands and project type.

## Verification Plan

### Manual Verification
- Verify `/ideate`, `/script`, `/pack` are listed in `CLAUDE.md`, `GEMINI.md`, and `cheatsheet.md`.
- Verify `scribe.md` and `auditor.md` correctly reference new skills.
- Verify `orchestration.md` routing table has `youtube`.
