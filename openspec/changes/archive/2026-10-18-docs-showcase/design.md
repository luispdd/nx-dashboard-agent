## Context

A README with an architecture diagram exists. `docs/adr/` holds `0015-apexcharts-visualization.md` and `ADR-015-apexcharts-visualization.md` (apparent duplicates) plus ADR-004, 016, 017 from spikes. Docker Compose deployment is complete. See proposal.md.

## Goals / Non-Goals

**Goals:**
- A newcomer can understand and run the project in under 10 minutes.
- Decisions and trade-offs are discoverable in the repo.

**Non-Goals:**
- Hosting a documentation site.
- Documenting the development plan file (not part of the project).

## Decisions

- **ADR naming**: `ADR-NNN-<slug>.md`, matching the majority. Delete `0015-...` after diffing against `ADR-015-...`; fix inbound links.
- **ADR backfill list** (one short ADR each): why not full microservices / two backend services; typed narrow agent tools, no free-form SQL; deterministic anomaly statistics in Python; agent never touches the DB; OpenAPI as contract with generated clients; Native Federation host + remote; derived read-only DB via ETL; UTC with `Z` timestamps; stub LLM at the E2E boundary; logs-only observability. New numbers continue after the highest existing one.
- **Talking points** at `docs/talking-points.md` as the user specified; structure: decisions, trade-offs, deliberately left out, possible next steps. Links to the ADRs rather than repeating them.
- **Demo assets**: record with Playwright video or a screen recorder and convert to GIF/WebP; store small files under `docs/media/`. Alternative: link to external hosting. Rejected: assets should live with the repo; keep sizes small.
- **10-minute check**: perform a fresh-clone run, note timestamps and record in the PR/talking points, adjusting the README until it holds.
- **Badge**: GitHub Actions badge for `ci.yml` once `quality-ci-pipeline` lands.
- **Ordering**: implement last so docs describe the final state.

## Risks / Trade-offs

- [Docs rot] -> keep README short and link to single-source docs; skills/AGENTS.md remain the place for tooling quirks.
- [Media bloat in git] -> cap file sizes, prefer WebP/short GIFs.
- [Duplicate ADR files differ] -> merge any unique content before deleting.
