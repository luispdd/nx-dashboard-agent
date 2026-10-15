from unittest.mock import AsyncMock, MagicMock

import pytest

from agent_service.config import Settings
from agent_service.llm_client import (
    get_llm_client,
    normalize_base_url,
    probe_model_reachability,
    probe_streaming_chat,
    probe_tool_calling,
)


def test_normalize_base_url() -> None:
    assert normalize_base_url("http://127.0.0.1:8888/api") == "http://127.0.0.1:8888/v1"
    assert (
        normalize_base_url("http://127.0.0.1:8888/api/") == "http://127.0.0.1:8888/v1"
    )
    assert normalize_base_url("http://127.0.0.1:8888/v1") == "http://127.0.0.1:8888/v1"


def test_settings_initialization() -> None:
    custom = Settings(
        llm_base_url="http://test-host:9999/api",
        llm_model="custom/test-model",
        llm_api_key="secret-key",
    )
    client = get_llm_client(custom)
    assert str(client.base_url) == "http://test-host:9999/v1/"
    assert client.api_key == "secret-key"


@pytest.mark.asyncio
async def test_probe_model_reachability_success() -> None:
    mock_client = MagicMock()
    mock_model_1 = MagicMock(id="test-openai-model-4b")
    mock_models_response = MagicMock(data=[mock_model_1])
    mock_client.models.list = AsyncMock(return_value=mock_models_response)

    res = await probe_model_reachability(client=mock_client)
    assert res["status"] == "success"
    assert "test-openai-model-4b" in res["models"]


@pytest.mark.asyncio
async def test_probe_streaming_chat_success() -> None:
    mock_client = MagicMock()

    class FakeChunk:
        def __init__(self, content: str | None) -> None:
            delta = MagicMock(content=content)
            self.choices = [MagicMock(delta=delta)]

    async def fake_stream():
        for token in ["Hello", " ", "World"]:
            yield FakeChunk(token)

    mock_client.chat.completions.create = AsyncMock(return_value=fake_stream())

    res = await probe_streaming_chat(
        prompt="Hi",
        client=mock_client,
        model="test-model",
    )
    assert res["status"] == "success"
    assert res["content"] == "Hello World"
    assert res["chunks_count"] == 3


@pytest.mark.asyncio
async def test_probe_tool_calling_success() -> None:
    mock_client = MagicMock()
    mock_tool_call = MagicMock()
    mock_tool_call.function.name = "get_device_status"
    mock_tool_call.function.arguments = '{"device_id": "esp32c6"}'

    mock_message = MagicMock(tool_calls=[mock_tool_call])
    mock_choice = MagicMock(message=mock_message)
    mock_response = MagicMock(choices=[mock_choice])
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    res = await probe_tool_calling(client=mock_client, model="test-model")
    assert res["status"] == "success"
    assert res["has_tool_calls"] is True
    assert res["tool_calls"][0]["name"] == "get_device_status"
    assert res["tool_calls"][0]["arguments"] == '{"device_id": "esp32c6"}'
