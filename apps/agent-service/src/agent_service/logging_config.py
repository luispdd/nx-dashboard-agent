import json
import logging
from datetime import UTC, datetime
from typing import Any

from agent_service.context import get_current_run_id, get_current_step

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

        log_data: dict[str, Any] = {
            "timestamp": iso_timestamp,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
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
                try:
                    # Test JSON serializability
                    json.dumps(value)
                    log_data[key] = value
                except (TypeError, OverflowError):
                    log_data[key] = str(value)

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
