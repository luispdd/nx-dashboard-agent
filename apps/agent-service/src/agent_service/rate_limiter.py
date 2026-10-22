import asyncio
import math
import time
from collections import defaultdict, deque
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager


class RateLimiter:
    """In-process sliding-window rate limiter and stream concurrency tracker."""

    def __init__(
        self,
        rate_limit_per_minute: int = 20,
        max_concurrent_streams: int = 3,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self.rate_limit_per_minute = rate_limit_per_minute
        self.max_concurrent_streams = max_concurrent_streams
        self._clock = clock or time.time
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        self._active_streams: dict[str, int] = defaultdict(int)
        self._lock = asyncio.Lock()

    async def check_rate_limit(self, client_ip: str) -> tuple[bool, int]:
        """Checks if a request is allowed under the sliding-window rate limit.

        Returns:
            (is_allowed, retry_after_seconds)
        """
        async with self._lock:
            now = self._clock()
            window_start = now - 60.0
            dq = self._requests[client_ip]

            # Prune timestamps outside the 60s sliding window
            while dq and dq[0] <= window_start:
                dq.popleft()

            if len(dq) >= self.rate_limit_per_minute:
                oldest_in_window = dq[0]
                retry_after = max(1, math.ceil(60.0 - (now - oldest_in_window)))
                return False, retry_after

            dq.append(now)
            return True, 0

    @asynccontextmanager
    async def track_concurrency(self, client_ip: str) -> AsyncIterator[bool]:
        """Async context manager to acquire and release an active stream slot.

        Yields:
            True if concurrency slot was acquired, False if concurrent limit was reached.
        """
        acquired = False
        async with self._lock:
            current = self._active_streams[client_ip]
            if current < self.max_concurrent_streams:
                self._active_streams[client_ip] = current + 1
                acquired = True

        try:
            yield acquired
        finally:
            if acquired:
                async with self._lock:
                    self._active_streams[client_ip] -= 1
                    if self._active_streams[client_ip] <= 0:
                        del self._active_streams[client_ip]

    async def active_stream_count(self, client_ip: str | None = None) -> int:
        async with self._lock:
            if client_ip:
                return self._active_streams.get(client_ip, 0)
            return sum(self._active_streams.values())

    async def reset(self) -> None:
        async with self._lock:
            self._requests.clear()
            self._active_streams.clear()


_global_rate_limiter: RateLimiter | None = None


def get_rate_limiter(
    rate_limit_per_minute: int = 20,
    max_concurrent_streams: int = 3,
) -> RateLimiter:
    global _global_rate_limiter
    if _global_rate_limiter is None:
        _global_rate_limiter = RateLimiter(
            rate_limit_per_minute=rate_limit_per_minute,
            max_concurrent_streams=max_concurrent_streams,
        )
    return _global_rate_limiter


def reset_rate_limiter() -> None:
    global _global_rate_limiter
    _global_rate_limiter = None
