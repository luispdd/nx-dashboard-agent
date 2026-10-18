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


def test_static_prompt_contains_no_data_tool_names() -> None:
    prompt = build_system_prompt()

    data_tool_names = [
        "list_metrics",
        "list_devices",
        "get_stats",
        "get_series",
        "compare_devices",
        "describe_dataset",
    ]

    for tool_name in data_tool_names:
        assert tool_name not in prompt, (
            f"Data tool name '{tool_name}' must not appear in the static system prompt"
        )


def test_build_system_prompt_server_instructions_injection() -> None:
    instructions = "Always check device firmware versions before comparing stats."
    prompt = build_system_prompt(server_instructions=instructions)

    assert "## Data Source Instructions" in prompt
    assert instructions in prompt
