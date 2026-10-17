## Purpose

Keeps repository guidance for coding agents compact, discoverable and self-contained, so always-loaded instructions stay short while detailed knowledge is available on demand.

## ADDED Requirements

### Requirement: Compact AGENTS.md
`AGENTS.md` SHALL contain only project summary, closed decisions, tool selection, non-negotiable rules, commands, definition of done and an index of skills. Detailed toolchain quirks and pitfalls SHALL live in skills.

#### Scenario: Pitfall entries relocated
- **WHEN** a quirk or pitfall entry previously in `AGENTS.md` is reviewed
- **THEN** it SHALL be present in exactly one skill and absent from `AGENTS.md`

#### Scenario: Skill index present
- **WHEN** `AGENTS.md` is read
- **THEN** it SHALL list every skill with a one-line description of when to use it

### Requirement: Skills use directory format
Every skill SHALL be stored at `.agents/skills/<name>/SKILL.md` with YAML frontmatter containing `name` (matching the directory) and a `description` stating when the skill applies.

#### Scenario: No flat skill files remain
- **WHEN** `.agents/skills/` is listed
- **THEN** no `*.SKILL.md` flat files SHALL exist and each skill directory SHALL contain a `SKILL.md`

#### Scenario: Migrated content preserved
- **WHEN** an existing skill is migrated
- **THEN** its substantive guidance SHALL be retained unchanged apart from frontmatter

### Requirement: Repository is self-contained
Repository guidance SHALL NOT reference `iot-dashboard-agent-plan.md` or other files that are not part of the repository.

#### Scenario: No plan references
- **WHEN** `AGENTS.md`, `.agents/**`, `docs/**` and `openspec/specs/**` are searched for `iot-dashboard-agent-plan`
- **THEN** no matches SHALL be found
