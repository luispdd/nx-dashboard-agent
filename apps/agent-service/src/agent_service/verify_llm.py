import asyncio
import json

from agent_service.config import settings
from agent_service.llm_client import (
    probe_model_reachability,
    probe_streaming_chat,
    probe_tool_calling,
)


async def main() -> None:
    print("--- LLM Connectivity Probe ---")
    print(f"Base URL: {settings.llm_base_url}")
    print(f"Configured Model: {settings.llm_model}")
    print("-------------------------------")

    print("\n1. Probing Models Endpoint...")
    models_res = await probe_model_reachability()
    print(json.dumps(models_res, indent=2))

    print("\n2. Testing Streaming Completion...")
    streaming_res = await probe_streaming_chat()
    print(json.dumps(streaming_res, indent=2))

    print("\n3. Testing Structured Tool Calling...")
    tool_res = await probe_tool_calling()
    print(json.dumps(tool_res, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
