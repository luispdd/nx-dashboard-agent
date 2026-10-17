import contextvars
import uuid
from collections.abc import Iterator
from contextlib import contextmanager

_current_run_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("current_run_id", default=None)
_current_step: contextvars.ContextVar[int | None] = contextvars.ContextVar("current_step", default=None)


def generate_run_id() -> str:
    """Generates a UUID4 string suitable for tracing an agent run."""
    return str(uuid.uuid4())


def get_current_run_id() -> str | None:
    """Returns the current run id active in the context, if any."""
    return _current_run_id.get()


def set_current_run_id(run_id: str | None) -> contextvars.Token[str | None]:
    """Sets the current run id in contextvars."""
    return _current_run_id.set(run_id)


def reset_current_run_id(token: contextvars.Token[str | None]) -> None:
    """Resets the current run id using the given token."""
    _current_run_id.reset(token)


def get_current_step() -> int | None:
    """Returns the current step index active in the context, if any."""
    return _current_step.get()


def set_current_step(step: int | None) -> contextvars.Token[int | None]:
    """Sets the current step index in contextvars."""
    return _current_step.set(step)


def reset_current_step(token: contextvars.Token[int | None]) -> None:
    """Resets the current step using the given token."""
    _current_step.reset(token)


@contextmanager
def run_context(run_id: str | None = None, step: int | None = None) -> Iterator[str]:
    """Context manager setting run_id and step for the duration of a block."""
    effective_run_id = run_id or generate_run_id()
    token_run_id = set_current_run_id(effective_run_id)
    token_step = set_current_step(step)
    try:
        yield effective_run_id
    finally:
        reset_current_run_id(token_run_id)
        reset_current_step(token_step)
