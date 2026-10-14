# Change Notes: m3-dashboard-ui

## Dev Proxy to NestJS API (Task 6.1)

- **NestJS Route & Port Exposure**:
  - `apps/dashboard-api/src/main.ts` configures `app.setGlobalPrefix('api')` and listens on `process.env.PORT || 3000`.
  - All endpoints are rooted under `/api/...` (e.g., `/api/metrics`, `/api/devices`, `/api/series`, `/api/stats`).
- **Proxy Configuration**:
  - Created `apps/dashboard-shell/proxy.conf.json` mapping `/api` to `http://localhost:3000` with `secure: false` and `changeOrigin: true`.
  - No `pathRewrite` was required because the NestJS API already serves routes with the `/api` prefix.
  - Added `"proxyConfig": "apps/dashboard-shell/proxy.conf.json"` to the `options` of `dashboard-shell:serve-original` (`@angular/build:dev-server`), which is wrapped by Native Federation's `serve` target.
- **Verification Results**:
  - Dev server port: `serve-original` defaults to `http://localhost:4200/`.
  - Proxied requests to `http://localhost:4200/api/metrics` and `http://localhost:4200/api/devices` return JSON data identical to direct calls to port 3000.
  - Browser navigation to `http://localhost:4200` loaded dynamically discovered metrics and devices, rendered the chart, and displayed per-board statistics without CORS console errors.
- **Production Routing Note**:
  - The `proxy.conf.json` configuration is development-only. Production container routing and reverse proxying will be configured in Milestone M7.

## Tailwind CSS v4 Configuration (Task 6.2)

- **Dependencies**:
  - Installed `tailwindcss`, `@tailwindcss/postcss`, and `postcss` in workspace root `devDependencies` using `bun add -D`.
- **PostCSS Location & Compatibility**:
  - Placed `.postcssrc.json` directly in `apps/dashboard-shell/.postcssrc.json` with `{ "plugins": { "@tailwindcss/postcss": {} } }`.
  - The project-level `.postcssrc.json` is successfully picked up by Angular's `@angular/build:application` executor without needing a workspace root config.
- **CSS Architecture**:
  - Created plain CSS entry `apps/dashboard-shell/src/tailwind.css` with `@import "tailwindcss";` and `@theme { ... }` custom design tokens (`--color-card`, `--color-rail`, `--color-accent`, etc.).
  - Removed `@use "tailwindcss";` from `styles.scss` to prevent Sass parsing issues with Tailwind v4.
  - Added `apps/dashboard-shell/src/tailwind.css` alongside `styles.scss` in `esbuild.options.styles` in `apps/dashboard-shell/project.json`.
- **Verification & Budgets**:
  - `bunx nx build dashboard-shell:production` passed.
  - Generated stylesheet size: 40.64 kB (total initial bundle 167.67 kB, well within the 500kb warning / 1mb error budget).
  - Verified presence of utility classes (`bg-slate-900`, `bg-accent`, `bg-card`, `bg-rail`, `font-mono`) in production CSS bundle.
  - Native Federation externals (`browser-angular_*`, `browser-ng_apexcharts`, etc.) remain completely intact and functional.
- **Conventions Updated**:
  - Updated `.agents/skills/angular-conventions.SKILL.md` documenting plain CSS Tailwind entry file, `@source` for library templates, and `@reference` for component SCSS.
