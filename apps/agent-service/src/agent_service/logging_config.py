import json
import logging
import re
from datetime import UTC, datetime
from typing import Any

from agent_service.context import get_current_run_id, get_current_step
from agent_service.security import mask_secret

BEARER_PATTERN = re.compile(r"(Bearer\s+)([A-Za-z0-9_\-\.]+)", re.IGNORECASE)
KEY_PATTERN = re.compile(r"(sk-[A-Za-z0-9_\-\.]{10,})", re.IGNORECASE)
ENC_PATTERN = re.compile(r"(enc:aes256:[a-f0-9:]+)", re.IGNORECASE)


def redact_text(text: str) -> str:
    """Redacts known token and key patterns from log message text."""
    text = BEARER_PATTERN.sub(r"\1[REDACTED]", text)
    text = KEY_PATTERN.sub(lambda m: mask_secret(m.group(1)), text)
    text = ENC_PATTERN.sub("[ENCRYPTED_SECRET]", text)
    return text


def sanitize_log_value(key: str, val: Any) -> Any:
    key_lower = key.lower()
    if any(s in key_lower for s in ("key", "token", "secret", "password", "auth")):
        if isinstance(val, str):
            return mask_secret(val)
        return "***"
    if isinstance(val, dict):
        return {sub_k: sanitize_log_value(sub_k, sub_v) for sub_k, sub_v in val.items()}
    if isinstance(val, list):
        return [sanitize_log_value(key, item) for item in val]
    if isinstance(val, str):
        return redact_text(val)
    return val

STANDARD_LOG_ATTRS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
    "taskName",
}


class JsonFormatter(logging.Formatter):
    """Custom log formatter formatting records into standard JSON structure."""

    def format(self, record: logging.LogRecord) -> str:
        # UTC timestamp normalized to ISO 8601 with trailing Z
        dt = datetime.fromtimestamp(record.created, tz=UTC)
        iso_timestamp = dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        raw_message = record.getMessage()
        message = redact_text(raw_message)

        log_data: dict[str, Any] = {
            "timestamp": iso_timestamp,
            "level": record.levelname,
            "logger": record.name,
            "message": message,
        }

        # Correlate run_id: check record attribute first, fall back to contextvar
        run_id = getattr(record, "run_id", None) or get_current_run_id()
        if run_id is not None:
            log_data["run_id"] = run_id

        # Correlate step: check record attribute first, fall back to contextvar
        step = getattr(record, "step", None)
        if step is None:
            step = get_current_step()
        if step is not None:
            log_data["step"] = step

        # Append custom extra fields passed in logger calls
        for key, value in record.__dict__.items():
            if key not in STANDARD_LOG_ATTRS and key not in log_data:
                sanitized = sanitize_log_value(key, value)
                try:
                    # Test JSON serializability
                    json.dumps(sanitized)
                    log_data[key] = sanitized
                except (TypeError, OverflowError):
                    log_data[key] = str(sanitized)

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


def setup_logging(level: int = logging.INFO) -> None:
    """Configures root logger with JsonFormatter."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(level)
