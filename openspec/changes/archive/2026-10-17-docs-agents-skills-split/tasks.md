## 1. Plan reference removal

- [x] 1.1 Remove all `iot-dashboard-agent-plan.md` references from `AGENTS.md`; verify with `grep -rn "iot-dashboard-agent-plan" AGENTS.md .agents docs openspec/specs` returning nothing
- [x] 1.2 Sweep remaining references (skills, README, docs) and remove them; verify the same grep over the whole repo (excluding `.gitignore`, `openspec/changes/archive`) is clean

## 2. Migrate existing skills to directory format

- [x] 2.1 Convert the 9 flat `.agents/skills/*.SKILL.md` files to `.agents/skills/<name>/SKILL.md` with `name` and `description` frontmatter; verify `ls .agents/skills` shows only directories and each contains `SKILL.md`
- [x] 2.2 Update references to old filenames (grep `\.SKILL\.md`, `AGENTS.md`, workflows); verify no dangling references

## 3. Create quirks skills and slim AGENTS.md

- [x] 3.1 Create the 7 quirks skills (`nx-and-tooling-quirks`, `angular-and-native-federation-quirks`, `react-mfe-and-chat-quirks`, `python-agent-service-quirks`, `nestjs-and-sqlite-quirks`, `docker-and-deployment-quirks`, `e2e-testing-quirks`) with trigger-oriented descriptions; verify frontmatter name matches the directory
- [x] 3.2 Move each entry from "Nx Generator & CLI Quirks" and "Toolchain Quirks & Pitfalls" into exactly one skill, cross-linking where relevant
- [x] 3.3 Verify no information loss: list every original bullet and confirm its destination in a checklist (kept in the change PR description)
- [x] 3.4 Rewrite `AGENTS.md` keeping project summary, closed decisions, tool selection, non-negotiable rules, commands, definition of done, and a skill index table; verify no quirk bullets remain and the file is substantially shorter

## 4. Verification

- [x] 4.1 Run `openspec validate --all` and confirm it passes
- [x] 4.2 Confirm the skill index in `AGENTS.md` lists every skill directory (script or manual diff)
