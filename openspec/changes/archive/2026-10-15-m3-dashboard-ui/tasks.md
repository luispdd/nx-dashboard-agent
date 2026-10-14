## 1. Backend Series Limit & Contract Pipeline

- [x] 1.1 Add optional `limit` query parameter to `SeriesQueryDto` with `@IsOptional()`, `@Type(() => Number)`, `@IsInt()`, and `@Min(1)`, and verify DTO validation unit tests pass.
- [x] 1.2 Update `KyselyMeasurementsRepository.getSeries` to support `limit` using SQLite partitioned window ranking (`ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY ts DESC)`) returned in chronological ascending order, and verify repository unit tests pass.
- [x] 1.3 Add unit tests to `SeriesController` asserting series limiting behavior, and verify `bunx nx test dashboard-api` exits 0.
- [x] 1.4 Re-export OpenAPI spec via `bunx nx run dashboard-api:export-openapi` and regenerate client contracts via `bunx nx run shared-contracts:generate-contracts`, verifying `limit?: number` is present in generated models.

## 2. Charting Infrastructure & Shell Layout

- [x] 2.1 Add `apexcharts` and `ng-apexcharts` dependencies to workspace via `bun install`, and create architectural decision record `docs/adr/0015-apexcharts-visualization.md`.
- [x] 2.2 Define dark mode theme tokens, surface variables, and typography in `apps/dashboard-shell/src/styles.scss`.
- [x] 2.3 Implement top navigation bar component (`HeaderComponent`) with navigation links (`Trends`, `Distribution`, `Settings`) and chat remote toggle button.
- [x] 2.4 Configure zoneless routing in `app.routes.ts` with OnPush view targets, and verify shell compiles cleanly.

## 3. Catalog Discovery & Dynamic Filter Bar

- [x] 3.1 Implement `CapabilitiesService` in `dashboard-shell` to fetch `/api/metrics` and `/api/devices` on load, sort devices alphabetically, and assign colors deterministically from `BOARD_PALETTE`.
- [x] 3.2 Implement `FilterBarComponent` rendering dynamic metric selector pills (with units and color badges) and device select dropdown.
- [x] 3.3 Implement two-line mutually exclusive button groups for Time Range (`10m`, `1h`, `3h`, `6h`, `1d`, `3d`, `7d`, `30d`) and Latest Points (`10`, `50`, `100`, `200`, `500`), ensuring selecting in one group immediately unselects the other.
- [x] 3.4 Implement segmented pill sampling toggle (`Regular Only` vs `All Data`), binding all filters to reactive signals with `localStorage` persistence.

## 4. Telemetry Visualization & Statistics Table

- [x] 4.1 Implement `<app-telemetry-chart>` wrapping `ng-apexcharts` with smooth area curves, gradient fills, dark tooltips, gap rendering, and viewer local-timezone formatting on the X-axis (`datetimeUTC: false`).
- [x] 4.2 Implement `<app-per-board-stats-table>` beneath the chart computing `min`, `max`, `avg`, `latest`, and `count` (measurement count) per device directly from active chart points with unit formatting.
- [x] 4.3 Assemble `TrendsViewComponent` coordinating filter bar, telemetry chart, statistics table, and empty/error states, and verify unit tests pass with `bunx nx test dashboard-shell`.

## 5. Secondary Views & Integration Verification

- [x] 5.1 Implement `DistributionViewComponent` at `/distribution` rendering an ApexCharts donut/bar chart illustrating measurement volume breakdown across devices.
- [x] 5.2 Implement `SettingsViewComponent` at `/settings` with form inputs for LLM `base_url`, `model`, and masked `api_key`.
- [x] 5.3 Write Playwright E2E tests in `apps/dashboard-shell-e2e` verifying top navigation, filter row mutual exclusivity, chart rendering, and stats table counts, and verify `bunx nx e2e dashboard-shell-e2e` passes.

## 6. Dev environment: API proxy and Tailwind

### 6.1 Dev proxy to the NestJS API
- [x] 6.1.1 Check how NestJS exposes routes (`setGlobalPrefix('api')` in `apps/dashboard-api/src/main.ts`) and which port it listens on (expected 3000). Record the findings in the change notes.
- [x] 6.1.2 Create `apps/dashboard-shell/proxy.conf.json` mapping `/api` to `http://localhost:3000` with `secure: false` and `changeOrigin: true`. Add `pathRewrite` only if NestJS has no global `api` prefix.
- [x] 6.1.3 Add `"proxyConfig": "apps/dashboard-shell/proxy.conf.json"` to the `options` of the **`serve-original`** target (`@angular/build:dev-server`). This is the target that the Native Federation `serve` target wraps. Do not add it to `serve`, `build` or `esbuild`.
- [x] 6.1.4 Make sure the API base path used by the generated `httpResource` services is relative (`/api`). No absolute `http://localhost:3000` URL anywhere in the shell, and no CORS configuration added to NestJS for development.
- [x] 6.1.5 Verify: start the API, run `bunx nx serve dashboard-shell`, and note the actual port it prints (the `serve` target uses `port: 0`).
  - [x] a request to `/api/metrics` on that port returns the NestJS JSON response
  - [x] the dashboard loads data in the browser with no CORS errors in the console
  - [x] if the wrapped `serve` target does not apply the proxy, record the finding and the workaround in the change notes instead of silently adding another config
- [x] 6.1.6 Document that the proxy is development-only. Production and Docker routing (reverse proxy) is handled in M7.

### 6.2 Tailwind CSS v4
- [x] 6.2.1 Install with bun, workspace root: `bun add -D tailwindcss @tailwindcss/postcss postcss` (all three, Tailwind v4).
- [x] 6.2.2 Create `apps/dashboard-shell/.postcssrc.json` with `{ "plugins": { "@tailwindcss/postcss": {} } }`.
- [x] 6.2.3 Create a **plain CSS** entry `apps/dashboard-shell/src/tailwind.css` containing `@import "tailwindcss";` and the `@theme { ... }` design tokens. Do **not** put the import inside `styles.scss` (Tailwind v4 is not designed to work through Sass).
- [x] 6.2.4 Add `apps/dashboard-shell/src/tailwind.css` to the `styles` array of the `esbuild` target, alongside `styles.scss`. Leave `inlineStyleLanguage` unchanged.
- [x] 6.2.5 Add `@source` entries for any `libs/` projects whose templates use Tailwind classes. Skip this until such a lib exists, and add a note to do it when the first one is created.
- [x] 6.2.6 Convention: use utility classes in templates (full class names only, never built from string fragments). If `@apply` or theme variables are needed in component styles, import the global tokens with `@reference`, or use `var(--color-...)` directly.
- [x] 6.2.7 Verify:
  - [x] one utility class and one `@theme` token render correctly in the running shell (`bunx nx serve dashboard-shell`)
  - [x] `bunx nx build dashboard-shell` (production) succeeds and the generated CSS contains the used classes
  - [x] the build budgets in `esbuild` (initial 500kb/1mb, component style 4kb/8kb) still pass
  - [x] Native Federation shared dependencies are unaffected (the shell still builds and loads)
  - [x] if `.postcssrc.json` in the project folder is not picked up, try the workspace root and record which location works
- [x] 6.2.8 Update the `angular-conventions` skill: Tailwind entry file is plain CSS, `@source` for libs, `@reference` rule for component styles.

### 6.3 Final checks
- [x] 6.3.1 `bunx nx affected -t lint test build` passes.
- [x] 6.3.2 The change notes list what was verified and the actual findings (port, proxy behavior, postcss location).

