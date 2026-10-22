import asyncio
import json
import logging

import pytest

from agent_service.config import Settings
from agent_service.context import (
    generate_run_id,
    get_current_run_id,
    get_current_step,
    reset_current_run_id,
    reset_current_step,
    run_context,
    set_current_run_id,
    set_current_step,
)
from agent_service.logging_config import JsonFormatter, setup_logging


def test_json_formatter_valid_json_output():
    formatter = JsonFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="Test log message with %s",
        args=("formatting",),
        exc_info=None,
    )
    formatted = formatter.format(record)
    data = json.loads(formatted)

    assert data["message"] == "Test log message with formatting"
    assert data["level"] == "INFO"
    assert data["logger"] == "test_logger"
    assert data["timestamp"].endswith("Z")
    assert "run_id" not in data
    assert "step" not in data


def test_json_formatter_includes_run_context_and_extras():
    formatter = JsonFormatter()
    run_id = generate_run_id()

    with run_context(run_id=run_id, step=2):
        record = logging.LogRecord(
            name="orchestrator",
            level=logging.INFO,
            pathname=__file__,
            lineno=25,
            msg="Step executed",
            args=(),
            exc_info=None,
        )
        record.event = "llm_call"  # type: ignore[attr-defined]
        record.duration_ms = 42.5  # type: ignore[attr-defined]
        record.model = "test-model"  # type: ignore[attr-defined]

        formatted = formatter.format(record)
        data = json.loads(formatted)

        assert data["run_id"] == run_id
        assert data["step"] == 2
        assert data["event"] == "llm_call"
        assert data["duration_ms"] == 42.5
        assert data["model"] == "test-model"


def test_log_payloads_setting_defaults_false(monkeypatch):
    monkeypatch.delenv("LOG_PAYLOADS", raising=False)
    s = Settings(runtime_config_path=None)
    assert s.log_payloads is False


def test_log_payloads_setting_can_be_enabled(monkeypatch):
    monkeypatch.setenv("LOG_PAYLOADS", "true")
    s = Settings(runtime_config_path=None)
    assert s.log_payloads is True


@pytest.mark.asyncio
async def test_run_context_propagation_across_async_generator():
    run_id = generate_run_id()

    async def async_event_stream():
        token_id = set_current_run_id(run_id)
        try:
            for s in range(3):
                token_step = set_current_step(s)
                try:
                    await asyncio.sleep(0.005)
                    yield {
                        "run_id": get_current_run_id(),
                        "step": get_current_step(),
                    }
                finally:
                    reset_current_step(token_step)
        finally:
            reset_current_run_id(token_id)

    collected = []
    async for item in async_event_stream():
        collected.append(item)

    assert len(collected) == 3
    assert collected[0] == {"run_id": run_id, "step": 0}
    assert collected[1] == {"run_id": run_id, "step": 1}
    assert collected[2] == {"run_id": run_id, "step": 2}

    # Context should be restored to None outside the generator
    assert get_current_run_id() is None
    assert get_current_step() is None


def test_setup_logging():
    setup_logging(level=logging.DEBUG)
    root = logging.getLogger()
    assert len(root.handlers) == 1
    assert isinstance(root.handlers[0].formatter, JsonFormatter)


def test_json_formatter_masks_secrets_in_message_and_extras():
    formatter = JsonFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="Connecting with Bearer supersecrettoken and key sk-1234567890abcdef12345",
        args=(),
        exc_info=None,
    )
    record.api_key = "sk-very-sensitive-llm-key-here"  # type: ignore[attr-defined]
    record.mcp_auth_token = "mcp-secret-bearer-token"  # type: ignore[attr-defined]
    record.normal_param = "public_value"  # type: ignore[attr-defined]

    formatted = formatter.format(record)
    data = json.loads(formatted)

    assert "supersecrettoken" not in data["message"]
    assert "Bearer [REDACTED]" in data["message"]
    assert "sk-1234567890abcdef12345" not in data["message"]
    assert "sk-...2345" in data["message"]
    assert data["api_key"] == "sk-...here"
    assert data["mcp_auth_token"] == "mcp...oken"
    assert data["normal_param"] == "public_value"

