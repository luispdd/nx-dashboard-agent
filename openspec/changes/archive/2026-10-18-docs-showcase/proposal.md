## Why

The repo must be understandable and runnable by a newcomer in under 10 minutes. The README is partial, ADRs only cover spikes (and one is duplicated), and there is no demo script, visual demo or place that explains trade-offs and what was deliberately left out.

## What Changes

- Refresh `README.md`: architecture diagram, quick start (`.env`, `docker compose up`), CI badge, links to docs.
- ADR cleanup: remove the duplicate `0015-apexcharts-visualization.md` (keeping `ADR-015-...`), and backfill ADRs for key closed decisions, including "why not full microservices".
- Add `docs/talking-points.md`: decisions, trade-offs, what was deliberately left out.
- Add a demo script and a short recording or GIFs of the main flows.
- Measure the clean-clone-to-running time and record it.
- Update the plan-derived statuses only where the repo itself documents them; the development plan file is not part of the project.

## Capabilities

### New Capabilities
- `showcase-documentation`: Required README, ADR, talking-points and demo content for the repository.

### Modified Capabilities

## Impact

- `README.md`, `docs/**`, demo media assets.
- Depends on the final state of CI and observability changes for badge and logging mentions.
- No application code changes.
