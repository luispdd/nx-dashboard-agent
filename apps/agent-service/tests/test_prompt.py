from datetime import UTC, datetime

from agent_service.agent.prompt import build_system_prompt


def test_build_system_prompt_calendar_injection() -> None:
    # Thursday, October 15, 2026 at 14:00:00Z
    fixed_now = datetime(2026, 10, 15, 14, 0, 0, tzinfo=UTC)
    prompt = build_system_prompt(now_utc=fixed_now, user_timezone="Europe/Madrid")

    assert "Today is Thursday, October 15, 2026 (UTC)." in prompt
    assert "Current UTC time is 14:00:00Z." in prompt
    assert "User viewing timezone: Europe/Madrid." in prompt
    assert "Factual Grounding" in prompt
    assert "Never fabricate, estimate, or hallucinate" in prompt
    assert "ISO-8601 UTC timestamps ending with Z" in prompt
