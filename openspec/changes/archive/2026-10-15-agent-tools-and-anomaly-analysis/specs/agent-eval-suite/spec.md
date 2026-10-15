## Purpose

Provides a reproducible evaluation harness and benchmark dataset to verify factual accuracy, tool selection, date resolution, and anomaly recall across local and cloud LLM providers.

## ADDED Requirements

### Requirement: Benchmark Evaluation Dataset
The agent service SHALL maintain a curated evaluation suite containing at least 20 benchmark questions with expected tool calls, required parameters, and ground-truth facts.

#### Scenario: Benchmark factual single-metric query
- **WHEN** the question "What was the maximum temperature for esp32c6 yesterday?" is evaluated
- **THEN** the harness asserts that `get_stats` is called with `metric_key="temperature"`, `device_id="esp32c6"`, the correct date window, and that the returned maximum value and unit (`°C`) appear in the final response

#### Scenario: Benchmark comparative date query
- **WHEN** the question "compare the average temperature deviation between yesterday and last tuesday for the device esp32c6" is evaluated
- **THEN** the harness asserts that the model executes sequential tool calls for both dates and calculates the numerical difference in daily averages accurately

#### Scenario: Benchmark anomaly detection query
- **WHEN** the question "Are any sensors reporting abnormal readings?" is evaluated
- **THEN** the harness asserts that `detect_anomalies` is invoked and the injected anomalies (peer deviation, spike, flatline, gap) are accurately reported

### Requirement: Single-Command Evaluation Runner
The evaluation suite SHALL be executable via a single CLI command, producing a structured summary of pass/fail results, precision, recall, and token latency.

#### Scenario: Run evaluations against configured model
- **WHEN** the developer executes the evaluation suite command
- **THEN** the harness runs all 20 test cases against the active LLM endpoint and outputs a scorecard detailing tool selection accuracy, factual precision, and execution times
