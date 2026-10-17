## Why

`AGENTS.md` has grown into a long list of toolchain quirks and pitfalls that is loaded into every agent session, whether relevant or not. The existing skills in `.agents/skills/` are flat `*.SKILL.md` files, not the `skills/<name>/SKILL.md` directory layout with frontmatter, so they may never be discovered. `AGENTS.md` also points at `iot-dashboard-agent-plan.md`, which is a development-time guideline that is git-ignored and not part of the project.

## What Changes

- Remove every reference to `iot-dashboard-agent-plan.md` from `AGENTS.md` (and from skills, specs and docs if found).
- Migrate the 9 existing flat skills to `.agents/skills/<name>/SKILL.md` with `name` and `description` frontmatter, preserving their content.
- Move the detailed "Toolchain Quirks & Pitfalls" and "Nx Generator & CLI Quirks" entries out of `AGENTS.md` into new topic skills (Nx/tooling, Angular & Native Federation, React MFE & chat, Python agent service, NestJS & SQLite, Docker & deployment, E2E testing).
- Keep in `AGENTS.md`: project summary, closed decisions, tool selection, non-negotiable rules, commands, definition of done, plus a short index mapping areas to skills.

## Capabilities

### New Capabilities
- `agent-guidance`: Structure and content rules for `AGENTS.md` and `.agents/skills/` so guidance stays compact, discoverable and self-contained in the repository.

### Modified Capabilities

## Impact

- `AGENTS.md`, `.agents/skills/**`.
- Any file referencing old skill filenames or the plan file (to be found by grep during implementation).
- No application code, APIs or dependencies change.
