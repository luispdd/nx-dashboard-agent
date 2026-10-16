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
The dashboard shell SHALL provide a container for docking and toggling the React chat assistant microfrontend remote loaded via Native Federation, maintaining DOM persistence across toggles.

#### Scenario: Toggling chat drawer
- **WHEN** a user clicks the chat assistant button in the shell header
- **THEN** the shell SHALL toggle the visibility of the chat microfrontend container via CSS transitions without reloading the active dashboard view or destroying the remote component tree

#### Scenario: Preserving conversation state across drawer toggles
- **WHEN** a user closes and re-opens the chat drawer
- **THEN** the chat microfrontend container SHALL remain mounted in the DOM so active conversation history, tool steps, and generation state are preserved intact

#### Scenario: Retrying remote connection on load failure
- **WHEN** the remote microfrontend fails to load (e.g. server starting up)
- **THEN** an error state with a retry button SHALL be rendered allowing the user to reconnect without reloading the page

### Requirement: Resizable Chat Drawer
The dashboard shell SHALL provide a draggable resize border on the chat assistant drawer allowing the user to dynamically adjust the drawer width between a minimum of 360px and a maximum of 50% of the browser's viewport width.

#### Scenario: Dragging border to resize drawer width
- **WHEN** the user drags the left border resize handle of the open chat drawer
- **THEN** the drawer width SHALL resize continuously following pointer movement without selecting page text

#### Scenario: Enforcing maximum width constraint
- **WHEN** the user attempts to expand the drawer beyond 50% of the browser viewport width
- **THEN** the drawer width SHALL be clamped to at most 50% of the current window width

#### Scenario: Enforcing minimum width constraint
- **WHEN** the user attempts to shrink the drawer below 360px
- **THEN** the drawer width SHALL be clamped to at least 360px

#### Scenario: Persisting drawer width
- **WHEN** the user resizes the drawer and subsequently closes and reopens it or reloads the page
- **THEN** the drawer SHALL retain the user's preferred width from storage

### Requirement: Demo data notification badge
The dashboard shell navigation header SHALL display a visible "Demo Data" announcement badge when connected to an API serving synthetic demo measurements, and omit or hide the badge when connected to authentic imported telemetry.

#### Scenario: Displaying demo badge for synthetic data
- **WHEN** the dashboard shell initializes and `GET /api/database/status` indicates `is_demo: true`
- **THEN** the header toolbar SHALL render an amber "Demo Data" badge with an active pulse indicator and a tooltip or text explaining that the active data is synthetic

#### Scenario: Hiding demo badge for authentic data
- **WHEN** the dashboard shell initializes and `GET /api/database/status` indicates `is_demo: false`
- **THEN** the header toolbar SHALL not render the "Demo Data" warning badge

