---
name: docker-and-deployment-quirks
description: Use when working on Dockerfiles, docker-compose, the root .env configuration, or when the containerized agent-service cannot reach a local LLM runner on the Linux host.
---

# Docker and deployment quirks

Pitfalls specific to the containerized deployment.

- **Docker Host Loopback on Linux (`network_mode: host`)**: Local LLM inference engines (such as Unsloth Studio) running on the Linux host bind strictly to `127.0.0.1`. When `agent-service` runs in a standard Docker bridge network, `host.docker.internal` maps to the bridge gateway (`172.17.0.1`), which cannot route packets to the host's loopback interface and fails with `[Errno 111] Connection refused`. Configure `network_mode: host` on `agent-service` in `docker-compose.yml` (with `http://127.0.0.1:8888/v1` for LLM and `http://localhost:3000` for `dashboard-api`) to allow direct loopback access without modifying the host LLM runner.
- **Centralized Root `.env` Configuration**: Docker Compose reads environment variables from `.env` in the workspace root. Ensure `.env` is created from `.env.example` and populated with secrets like `LLM_API_KEY`. It is excluded by `.gitignore` (`*.env`) so secrets are never committed.
