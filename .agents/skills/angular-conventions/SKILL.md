---
name: angular-conventions
description: Use when creating or changing anything in the Angular shell (dashboard), including components, charts, state, routing, forms, services and the dashboard context contract with the React chat remote.
---

# Angular conventions (shell / host)

Commands go through `nx ...`. Use the workspace's installed Angular version and its current idioms; check the installed version before using newer APIs.

## Structure

- **Standalone components** only; no NgModules.
- **Zoneless change detection** (`provideExperimentalZonelessChangeDetection()`, no `zone.js`).
- **Strict file separation**: dedicated `.ts` (component class), `.html` (template), and `.scss` (stylesheet) for every component; no inline templates or inline styles.
- **Styling**: Tailwind CSS v4 utility classes paired with modular SCSS.
  - The Tailwind entry file is plain CSS (`src/tailwind.css`), containing `@import "tailwindcss";` and `@theme { ... }` tokens. Do **not** import Tailwind inside `.scss` files.
  - In `project.json`, include `src/tailwind.css` alongside `src/styles.scss` in the `esbuild` `styles` array.
  - Add `@source` entries in `tailwind.css` for any `libs/` projects whose templates use Tailwind classes.
  - **No Hexadecimal Colors in HTML**: Never use hexadecimal color values directly in HTML templates.
    - Absolutely no arbitrary Tailwind hex classes (e.g., `bg-[#...]`, `text-[#...]`, `border-[#...]`).
    - Absolutely no inline styles containing hex colors (`style="color: #..."`).
  - **Theme Storage**: All colors must be stored in the theme files (`@theme` in `src/tailwind.css` and `:root` in `src/styles.scss`).
  - **Color Usage**: Apply colors in templates using semantic utility classes (e.g., `bg-card`, `bg-rail`, `text-accent`, full class names only, never built from string fragments) or generic classes. If custom styles or theme variables are needed in component SCSS, reference theme variables via `var(--...)` or `@reference`. Never hardcode raw hex values in SCSS or HTML.
- Feature-oriented folders; smart (container) components fetch and coordinate, presentational components take inputs and emit outputs.
- No business or data logic in components. Put it in services or pure functions that are easy to test.

## Components and state

- `ChangeDetectionStrategy.OnPush` on every component.
- Use **signals** for local and shared state (`signal`, `computed`, `effect` sparingly); use `input()`, `output()` and `model()` function APIs. Prioritize signals over RxJS.
- Use the built-in control flow (`@if`, `@for` with `track`, `@switch`).
- Use `inject()` instead of constructor injection.
- Avoid manual subscriptions; use `toSignal`, the async-friendly resource/httpResource-style APIs if available, or `takeUntilDestroyed`.
- Derived state is `computed`, never duplicated state kept in sync by hand.

## Data access

- Use the **generated OpenAPI client** from `libs/shared/contracts`. Never hand-write DTOs or API calls that duplicate the contract.
- All HTTP goes through services in a data-access layer; components never call `HttpClient` directly.
- Handle loading, empty and error states explicitly for every data view.

## Dashboard specifics

- Panels are **driven by the metric catalogue** (`metric_key` and `unit` from the API). One generic chart component parametrized by metric; one line per device. Never hardcode metric names or units.
- Charts: rendered with **ApexCharts** (`ng-apexcharts` / `apexcharts`, ADR-015) wrapped in a dedicated chart component. Render gaps as gaps; do not interpolate across missing data. Downsampling happens server-side; request an appropriate `bucket` for the selected range.
- Regular readings by default; on-demand readings only as an optional overlay or toggle.
- **Timestamps:** API values are UTC ISO-8601 with `Z`. Convert to the viewer's timezone only for display (use `Intl`/a date library with explicit timezone). Never parse zone-less strings.
- Daily buckets follow the user's local day; test DST edges.

## Micro frontend host

- The shell loads the React remote at runtime via **Native Federation** (`@angular-architects/native-federation` using native browser ESM and Import Maps).
- The shell publishes the **dashboard context** (selected metric, devices, range) through the shared contract in `libs/shared-mfe-context`. It must not import anything from the chat remote.
- Handle the remote failing to load (show a fallback, do not break the dashboard).

## Quality & Testing

- Strict TypeScript; no `any` without a comment explaining why.
- Accessibility: semantic elements, keyboard navigation, labels for charts (text summary or table alternative), sufficient color contrast.
- Templates stay simple; move logic out of templates.
- **Unit tests**: Vitest via `@angular/build:unit-test` (`vitest-angular` locked to `^4.0.8`).
- **E2E tests**: Playwright (`dashboard-shell-e2e`).

## Checklist

- [ ] Standalone, OnPush, signals, new control flow
- [ ] No hexadecimal color values in HTML templates; all colors stored in theme files and applied via semantic classes or SCSS variables
- [ ] Generated client only; loading/empty/error states
- [ ] Metric-driven, units from the catalogue, UTC in and local time only for display
- [ ] No imports from the chat remote; context via shared contract
- [ ] Tests and lint pass (`nx affected -t lint test`)
