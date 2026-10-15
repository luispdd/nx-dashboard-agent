# agent-anomaly-detection Specification

## Purpose

Computes deterministic statistical anomalies across IoT telemetry data in pure Python, identifying peer deviations, spikes, flatlines, and missing reading gaps without external numerical libraries.

## Requirements

### Requirement: Deterministic Anomaly Detection Tool
The agent service SHALL expose a `detect_anomalies` tool that executes deterministic statistical checks on telemetry series retrieved from the NestJS API and outputs structured finding records.

#### Scenario: Scan for anomalies across devices
- **WHEN** the agent invokes `detect_anomalies` for a metric and time window
- **THEN** the system fetches series data, executes the statistical detector pipeline, and returns a list of typed anomaly findings

### Requirement: Peer Deviation Detection
The system SHALL compute cross-device deviations by calculating the median value among peer devices for each time bucket and flagging any device whose deviation from the peer median exceeds configured mathematical thresholds.

#### Scenario: Identify temperature offset from peer fleet
- **WHEN** a device reads significantly higher than peer nodes (e.g. $+8.5^\circ\text{C}$ over peer median) for multiple consecutive buckets
- **THEN** the detector produces a `peer_deviation` finding identifying the device, timestamp window, and numerical difference evidence

### Requirement: Transient Spike Detection
The system SHALL identify rapid departures from a device's baseline using Median Absolute Deviation (MAD) robust Z-score calculation.

#### Scenario: Detect single-bucket humidity spike
- **WHEN** a sensor reading departs from its rolling window median by more than 4 times the MAD
- **THEN** the detector flags a `spike` finding containing the peak value, expected baseline, and timestamp

### Requirement: Sensor Flatline Detection
The system SHALL detect stuck or unresponsive sensors by evaluating the variance of readings over a sliding window.

#### Scenario: Flag zero-variance sensor readings
- **WHEN** a sensor reports identical or near-zero variance readings ($\sigma < 0.01$) over an interval exceeding the configured duration (e.g. $\ge 6$ hours)
- **THEN** the detector emits a `flatline` finding with the frozen value and duration

### Requirement: Telemetry Gap Detection
The system SHALL identify missing scheduled readings when the elapsed duration between consecutive regular readings exceeds the expected 5-minute interval plus tolerance.

#### Scenario: Identify telemetry silence
- **WHEN** no regular readings are received from a registered device for longer than 15 minutes within the requested window
- **THEN** the detector emits a `gap` finding indicating the start and end of the missing interval

### Requirement: Structured Finding Output Schema
Every anomaly detected SHALL conform to a strict schema containing `device_id`, `metric_key`, `type`, `severity` (`low`, `medium`, `high`), `window` (`from`, `to`), `evidence` dictionary of observed numbers, and a human-readable deterministic summary.

#### Scenario: Validate finding record structure
- **WHEN** any anomaly detector generates a result
- **THEN** the finding record contains all required fields with exact numerical evidence and ISO-8601 UTC timestamps
