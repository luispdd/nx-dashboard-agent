from typing import Any

from openai import AsyncOpenAI

from agent_service.config import Settings, settings


def normalize_base_url(url: str) -> str:
    cleaned = url.rstrip("/")
    if cleaned.endswith("/api"):
        return f"{cleaned[:-4]}/v1"
    return cleaned


def get_llm_client(custom_settings: Settings | None = None) -> AsyncOpenAI:
    cfg = custom_settings or settings
    return AsyncOpenAI(
        base_url=normalize_base_url(cfg.llm_base_url),
        api_key=cfg.llm_api_key or "not-needed",
    )


async def probe_model_reachability(
    client: AsyncOpenAI | None = None,
) -> dict[str, Any]:
    c = client or get_llm_client()
    try:
        models = await c.models.list()
        return {
            "status": "success",
            "models": [m.id for m in models.data],
        }
    except Exception as err:  # noqa: BLE001
        return {
            "status": "error",
            "error": str(err),
        }


async def probe_streaming_chat(
    prompt: str = "Ping",
    client: AsyncOpenAI | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    c = client or get_llm_client()
    m = model or settings.llm_model
    collected_chunks: list[str] = []
    try:
        stream = await c.chat.completions.create(
            model=m,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            max_tokens=30,
        )
        async for chunk in stream:
            content = chunk.choices[0].delta.content if chunk.choices else None
            if content:
                collected_chunks.append(content)

        return {
            "status": "success",
            "content": "".join(collected_chunks),
            "chunks_count": len(collected_chunks),
        }
    except Exception as err:  # noqa: BLE001
        return {
            "status": "error",
            "error": str(err),
            "chunks_count": len(collected_chunks),
        }


async def probe_tool_calling(
    client: AsyncOpenAI | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    c = client or get_llm_client()
    m = model or settings.llm_model

    tools: list[dict[str, Any]] = [
        {
            "type": "function",
            "function": {
                "name": "get_device_status",
                "description": "Returns status of an IoT node",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "device_id": {
                            "type": "string",
                            "description": "The board identity string, e.g. esp32c6",
                        }
                    },
                    "required": ["device_id"],
                },
            },
        }
    ]

    try:
        response = await c.chat.completions.create(
            model=m,
            messages=[
                {
                    "role": "user",
                    "content": "Check the status for device esp32c6 using get_device_status tool",
                }
            ],
            tools=tools,  # type: ignore[arg-type]
            tool_choice="auto",
            max_tokens=100,
        )

        message = response.choices[0].message
        tool_calls = message.tool_calls or []

        return {
            "status": "success",
            "has_tool_calls": len(tool_calls) > 0,
            "tool_calls": [
                {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                }
                for tc in tool_calls
            ],
        }
    except Exception as err:  # noqa: BLE001
        return {
            "status": "error",
            "error": str(err),
        }
