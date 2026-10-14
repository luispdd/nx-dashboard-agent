# dashboard-shell-layout Specification

## Purpose

Establishes the responsive zoneless Angular 22 shell architecture, top navigation bar, theme variables, and mounting container for microfrontend remotes.

## Requirements

### Requirement: Zoneless Shell Architecture and Theming
The dashboard shell application SHALL run without `zone.js` using Angular zoneless change detection and render an accessible, dark-themed responsive layout with CSS design tokens.

#### Scenario: Zoneless execution
- **WHEN** the dashboard shell application bootstraps
- **THEN** it SHALL provide zoneless change detection via `provideExperimentalZonelessChangeDetection` and enforce `ChangeDetectionStrategy.OnPush` across all shell components

#### Scenario: Dark theme visual tokens
- **WHEN** the shell renders its user interface
- **THEN** it SHALL apply dark mode background, surface, rail, border, divider, and text tokens with high visual contrast

#### Scenario: Tailwind compiles through the Angular build
- **GIVEN** `tailwind.css` is listed in the `esbuild` styles
- **WHEN** a template uses a utility class and a theme token
- **THEN** both SHALL appear in the compiled CSS and render in the app, without importing Tailwind from SCSS

### Requirement: Development API Proxy
The dashboard shell development server SHALL proxy local `/api` HTTP requests to the running NestJS API service without CORS errors.

#### Scenario: API calls go through the dev proxy
- **GIVEN** the NestJS API is running and the shell is served with `bunx nx serve dashboard-shell`
- **WHEN** the shell requests `/api/metrics`
- **THEN** the response SHALL come from NestJS and the browser reports no CORS error

### Requirement: Top Navigation Routing
The dashboard shell SHALL provide a persistent top navigation header with active-route highlighting and client-side routing across dashboard sections.

#### Scenario: Navigating to primary trends view
- **WHEN** a user visits the root path `/` or clicks the "Trends" navigation item
- **THEN** the router SHALL activate the primary time-series telemetry trends view

#### Scenario: Navigating to distribution view
- **WHEN** a user clicks the "Distribution" navigation item
- **THEN** the router SHALL navigate to `/distribution` and display the device measurement breakdown view

#### Scenario: Navigating to settings view
- **WHEN** a user clicks the "Settings" navigation item
- **THEN** the router SHALL navigate to `/settings` and display the runtime LLM configuration view

### Requirement: Remote Chat Container
The dashboard shell SHALL provide a container for docking and toggling the React chat assistant microfrontend remote loaded via Native Federation.

#### Scenario: Toggling chat drawer
- **WHEN** a user clicks the chat assistant button in the shell header
- **THEN** the shell SHALL toggle the visibility of the chat microfrontend container without reloading the active dashboard view or resetting filter state
