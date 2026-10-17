## Context

`AGENTS.md` mixes always-relevant rules with ~50 situational quirks. Skills under `.agents/skills/` exist as flat `<name>.SKILL.md` files (agent-tool-design, angular-conventions, data-and-time-rules, fastapi-python-conventions, nestjs-conventions, nx-workspace-conventions, openspec-workflow, react-mfe-conventions, testing-strategy). The directory layout `skills/<name>/SKILL.md` with frontmatter is what discovery expects. See proposal.md.

## Goals / Non-Goals

**Goals:**
- Short `AGENTS.md` that still tells an agent which skill to read for which area.
- No loss of information: every moved entry lands in exactly one skill.
- All skills in the directory format.

**Non-Goals:**
- Rewording or re-validating quirk content (move verbatim; fix only broken cross-references).
- Touching the OpenSpec skills/workflows that already use the directory format (`openspec-*`).

## Decisions

- **Move verbatim, group by area.** Seven new skills: `nx-and-tooling-quirks`, `angular-and-native-federation-quirks`, `react-mfe-and-chat-quirks`, `python-agent-service-quirks`, `nestjs-and-sqlite-quirks`, `docker-and-deployment-quirks`, `e2e-testing-quirks`. Alternative: merging quirks into the existing `*-conventions` skills. Rejected: conventions are stable rules, quirks are situational lessons, and mixing them dilutes both.
- **Keep an index in AGENTS.md.** A table "area -> skill -> when to read". Alternative: rely only on skill descriptions. Rejected: AGENTS.md is the one file guaranteed to be loaded, and the index is cheap.
- **Ambiguous entries** (e.g. Playwright + Nx, Vite + Docker) go to the skill of the tool that causes the problem; cross-link from the other skill rather than duplicating.
- **Rename `openspec-workflow.SKILL.md`** to `openspec-workflow/SKILL.md` and `testing-strategy` likewise; update the frontmatter `name` to match the directory.
- **Plan file references** are removed outright, not replaced; milestone context is not needed at runtime. Any other reference found by `grep -r iot-dashboard-agent-plan` is handled the same way.
- **Do not edit `.gitignore`**: the plan file stays ignored.

## Risks / Trade-offs

- [Agents may not read the right skill] -> Descriptions state concrete triggers (tool names, error messages) and the AGENTS.md index repeats them.
- [Information loss during the move] -> Verify with a checklist: list every bullet in the old AGENTS.md and tick where it landed (task 3.3).
- [Stale references to old skill filenames] -> grep for `.SKILL.md` and old paths after migration.
- [AGENTS.md also references `data-and-time-rules` etc. by name] -> keep names stable.
