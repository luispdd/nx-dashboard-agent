## ADDED Requirements

### Requirement: Remote Runtime Error Boundary
The chat microfrontend SHALL encapsulate its component tree in a runtime error boundary to prevent unhandled React exceptions from crashing the host shell container.

#### Scenario: Catching uncaught render errors
- **WHEN** an unhandled component error occurs during chat rendering or streaming
- **THEN** the error boundary SHALL catch the exception and display a localized recovery card with error details without unmounting or crashing the host shell

#### Scenario: Resetting assistant state from error boundary
- **WHEN** the user clicks the reset button on the error boundary recovery card
- **THEN** the error state SHALL clear, conversation state SHALL reset, and the assistant UI SHALL return to the initial ready state
