## 1. ADR cleanup and backfill

- [x] 1.1 Diff `docs/adr/0015-apexcharts-visualization.md` against `ADR-015-apexcharts-visualization.md`, merge any unique content, delete the `0015-` file and fix inbound links; verify only one ADR-015 remains and grep finds no dangling links
- [x] 1.2 Write the backfill ADRs listed in the design (including "why not full microservices"), numbered after the highest existing ADR; verify each follows the existing ADR format
- [x] 1.3 Add `docs/adr/README.md` index; verify it lists every ADR

## 2. Verification

- [x] 2.1 Confirm no references to the development plan file remain in README or docs
- [x] 2.2 Run `openspec validate --all` and confirm it passes
