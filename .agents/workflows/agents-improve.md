---
description: "Extract reusable operational insights (gotchas, commands, pitfalls) to AGENTS.md"
---

Analyze the session just completed strictly through the lens of reusable operational knowledge for future sessions.

### Core Intent:
Do NOT document changelogs, task summaries, or project specifications (general project architecture and specs belong in dedicated spec files). Your sole objective is capturing **durable institutional knowledge**: hard-won insights, environment quirks, non-obvious failure modes, and critical CLI commands.

### Inclusion Criteria (Add ONLY if true):
- **Tooling / Environment Quirks**: Toolchain flags, flashing/build quirks, environment variables, or dependency collisions that required non-obvious fixes.
- **Critical Pitfalls**: "Dead ends" or mistakes made during this session that a future agent might repeat if not explicitly warned.
- **Essential Operational Commands**: Non-standard or exact commands required for building, flashing, debugging, or validating this project that are not self-evident.

*If the task was routine implementation with zero reusable pitfalls or operational surprises, state that no updates are needed and do not modify the file.*

### Rules for Updating `AGENTS.md`:
1. **Target File**: Locate `AGENTS.md` at the repository root (create it if missing).
2. **Concise & Imperative**: Write telegraphic, direct bullet points or mini-tables. Avoid narrative prose, history lessons, or task recaps.
3. **Appropriate Section**: Integrate new entries into existing operational sections (e.g., `## Operational Pitfalls & Gotchas`, `## Hardware / Flashing Quirks`, `## Verification Commands`).
4. **No Duplication**: Check existing entries first; refine existing points rather than adding redundant notes.

User input/focus: $ARGUMENTS

Inspect `AGENTS.md`, make only the strictly reusable additions, and summarize only the new rules added.