## ADDED Requirements

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
