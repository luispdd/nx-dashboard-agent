## 1. ADR cleanup and backfill

- [ ] 1.1 Diff `docs/adr/0015-apexcharts-visualization.md` against `ADR-015-apexcharts-visualization.md`, merge any unique content, delete the `0015-` file and fix inbound links; verify only one ADR-015 remains and grep finds no dangling links
- [ ] 1.2 Write the backfill ADRs listed in the design (including "why not full microservices"), numbered after the highest existing ADR; verify each follows the existing ADR format
- [ ] 1.3 Add `docs/adr/README.md` index; verify it lists every ADR

## 2. Talking points and demo

- [ ] 2.1 Write `docs/talking-points.md` (decisions, trade-offs, deliberately left out, next steps) linking ADRs; verify the README links to it
- [ ] 2.2 Write `docs/demo-script.md` covering dashboard, filters, chat with tool steps, and database upload; verify by following it end to end on the running stack
- [ ] 2.3 Record the demo (GIFs/WebP/video) under `docs/media/` and embed in README or demo script; verify file sizes are reasonable and media renders on GitHub

## 3. README refresh

- [ ] 3.1 Update README: architecture diagram (ASCII or Mermaid), quick start (`cp .env.example .env`, `docker compose up`), CI badge, docs links; verify links resolve
- [ ] 3.2 Perform a clean-clone run following only the README and record elapsed time; verify under 10 minutes, adjusting docs if not

## 4. Verification

- [ ] 4.1 Confirm no references to the development plan file remain in README or docs
- [ ] 4.2 Run `openspec validate --all` and confirm it passes
