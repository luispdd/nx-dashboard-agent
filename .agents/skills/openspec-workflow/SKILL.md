---
name: openspec-workflow
description: Use when starting, implementing, reviewing or finishing any OpenSpec change in this repo. Covers sizing, slicing, and keeping specs and code in sync.
---

# OpenSpec workflow

This repository is developed spec-first with OpenSpec. Active and archived changes live under `openspec/changes/`; accepted capabilities live under `openspec/specs/`.

Use the commands and slash commands of the installed OpenSpec version (run `openspec --help` or check its generated instructions) rather than assuming exact syntax.

## Loop

1. **Pick** one change. One change = one vertical slice that can be demonstrated.
2. **Propose** it: the why, the scope, and what is explicitly out of scope.
3. **Write the spec deltas** as requirements with testable scenarios (given / when / then). Prefer observable behavior and contracts over implementation details.
4. **Break into tasks**, small enough to finish and verify one at a time.
5. **Implement** task by task. Do not add behavior that is not in the spec.
6. **Verify**: run lint, types and tests for affected projects; walk through every scenario in the spec.
7. **Update the spec** if reality diverged (and say why), then archive the change.

## Rules

- Keep changes small. If a change needs more than about a day of work or touches more than two projects, split it.
- Specs describe contracts that matter: API shapes, tool schemas, data rules, acceptance scenarios. Do not paste large code into specs.
- Every spec scenario must map to at least one test or an explicit manual check noted in the tasks.
- Decisions with trade-offs go in `docs/adr/` (short: context, decision, consequences). Reference the ADR from the spec.
- If two specs or artifacts disagree, stop and ask; do not silently pick one.
- Spike changes are time-boxed and end with a written outcome: works, workaround, or blocked.

## Spec checklist

- [ ] Purpose and scope are clear, non-goals stated
- [ ] Requirements are testable and unambiguous
- [ ] Timestamps, units and sampling rules follow `data-and-time-rules` where relevant
- [ ] API or tool contract changes are listed and the OpenAPI impact is noted
- [ ] Error and empty-data behavior is specified
