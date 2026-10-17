# ADR-020: Anomaly Detection — Deterministic Python Statistics with LLM Interpretation

## Status
Accepted

## Context
Detecting abnormal device behavior (e.g. sensor drift, frozen values, erratic voltage spikes, sudden packet loss) is a primary requirement for the IoT analytical assistant.

LLMs are probabilistic token generators; asking an LLM to calculate means, standard deviations, z-scores, IQR fences, or moving averages directly from raw telemetry streams in the prompt causes severe calculation errors, high latency, context window exhaustion, and non-reproducible answers.

## Decision
We decouple **statistical computation** from **natural language interpretation**:
1. **Deterministic Computation in Python**:
   - Statistical algorithms (z-score analysis, IQR outlier detection, sliding-window standard deviation, rate-of-change thresholds) are implemented in pure Python using NumPy/SciPy in `apps/agent-service`.
   - Calculations produce exact numerical scores, outlier flags, and confidence intervals.
2. **LLM Role Limited to Interpretation**:
   - The LLM agent receives structured JSON output from the deterministic detector containing detected anomalies, baseline statistics, and device metadata.
   - The LLM's task is solely to interpret the statistical findings, contextualize the environmental conditions, and formulate actionable diagnostic recommendations for the operator.

## Consequences & Verification
- **Reliability**: Anomaly identification is 100% deterministic, testable with standard unit tests (`pytest`), and mathematically sound.
- **Token Efficiency**: The agent context receives condensed anomaly summaries rather than thousands of raw numerical time-series points.
- **Verifiable Explanations**: The operator receives explainable reasoning grounded in objective mathematical calculations rather than model hallucinations.
