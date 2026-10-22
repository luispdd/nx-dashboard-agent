import pytest

from agent_service.rate_limiter import RateLimiter


class MockClock:
    def __init__(self, start_time: float = 1000.0) -> None:
        self.time = start_time

    def __call__(self) -> float:
        return self.time

    def advance(self, seconds: float) -> None:
        self.time += seconds


@pytest.mark.asyncio
async def test_sliding_window_rate_limiting() -> None:
    clock = MockClock(1000.0)
    limiter = RateLimiter(rate_limit_per_minute=3, clock=clock)

    # 3 requests allowed
    ok1, retry1 = await limiter.check_rate_limit("127.0.0.1")
    assert ok1 is True
    assert retry1 == 0

    clock.advance(10.0)  # t=1010
    ok2, _retry2 = await limiter.check_rate_limit("127.0.0.1")
    assert ok2 is True

    clock.advance(10.0)  # t=1020
    ok3, _retry3 = await limiter.check_rate_limit("127.0.0.1")
    assert ok3 is True

    # 4th request at t=1020 rejected
    ok4, retry4 = await limiter.check_rate_limit("127.0.0.1")
    assert ok4 is False
    # Oldest was at 1000.0, so at 1020.0, retry_after should be 60 - (1020 - 1000) = 40
    assert retry4 == 40

    # Advance clock past the first request window (t=1061)
    clock.advance(41.0)
    ok5, retry5 = await limiter.check_rate_limit("127.0.0.1")
    assert ok5 is True
    assert retry5 == 0


@pytest.mark.asyncio
async def test_distinct_client_ip_limits() -> None:
    clock = MockClock(1000.0)
    limiter = RateLimiter(rate_limit_per_minute=1, clock=clock)

    ok1, _ = await limiter.check_rate_limit("127.0.0.1")
    assert ok1 is True

    ok2, _ = await limiter.check_rate_limit("127.0.0.1")
    assert ok2 is False

    # Different IP should have independent quota
    ok_other, _ = await limiter.check_rate_limit("192.168.1.50")
    assert ok_other is True


@pytest.mark.asyncio
async def test_concurrency_tracking() -> None:
    limiter = RateLimiter(max_concurrent_streams=2)

    async with limiter.track_concurrency("127.0.0.1") as stream1_ok:
        assert stream1_ok is True
        assert await limiter.active_stream_count("127.0.0.1") == 1

        async with limiter.track_concurrency("127.0.0.1") as stream2_ok:
            assert stream2_ok is True
            assert await limiter.active_stream_count("127.0.0.1") == 2

            # 3rd concurrent stream for same IP rejected
            async with limiter.track_concurrency("127.0.0.1") as stream3_ok:
                assert stream3_ok is False
                assert await limiter.active_stream_count("127.0.0.1") == 2

        # After stream 2 exits, active count drops to 1
        assert await limiter.active_stream_count("127.0.0.1") == 1

    # After stream 1 exits, active count drops to 0
    assert await limiter.active_stream_count("127.0.0.1") == 0
