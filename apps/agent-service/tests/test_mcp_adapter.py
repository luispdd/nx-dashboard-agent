"""Unit tests for MCP to OpenAI schema adapter."""

from mcp.types import Tool

from agent_service.tools.mcp_adapter import (
    mcp_tool_to_openai_function,
    normalize_schema_dict,
)


def test_normalize_schema_strips_metadata_keywords():
    schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "$id": "https://example.com/schema.json",
        "title": "TestSchema",
        "$defs": {"ExtraType": {"type": "string"}},
        "definitions": {"OldType": {"type": "number"}},
        "type": "object",
        "properties": {
            "metric_key": {
                "type": "string",
                "title": "Metric Key",
                "description": "Identifier",
            }
        },
        "required": ["metric_key"],
    }

    normalized = normalize_schema_dict(schema)

    assert "$schema" not in normalized
    assert "$id" not in normalized
    assert "title" not in normalized
    assert "$defs" not in normalized
    assert "definitions" not in normalized
    assert normalized["type"] == "object"
    assert normalized["additionalProperties"] is False
    assert normalized["required"] == ["metric_key"]
    assert "metric_key" in normalized["properties"]
    assert "title" not in normalized["properties"]["metric_key"]
    assert normalized["properties"]["metric_key"]["type"] == "string"


def test_normalize_schema_nested_objects_and_arrays():
    schema = {
        "type": "object",
        "properties": {
            "filters": {
                "type": "object",
                "properties": {
                    "tag": {"type": "string"},
                },
            },
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "$schema": "http://json-schema.org/draft-07/schema#",
                    "properties": {
                        "id": {"type": "string"},
                    },
                },
            },
        },
    }

    normalized = normalize_schema_dict(schema)

    assert normalized["additionalProperties"] is False
    assert normalized["properties"]["filters"]["additionalProperties"] is False
    assert "$schema" not in normalized["properties"]["items"]["items"]
    assert normalized["properties"]["items"]["items"]["additionalProperties"] is False


def test_mcp_tool_to_openai_function_from_tool_instance():
    tool = Tool(
        name="get_series",
        description="Fetch downsampled time series points",
        inputSchema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
                "metric_key": {"type": "string"},
                "limit": {"type": "integer"},
            },
            "required": ["metric_key"],
        },
    )

    openai_fn = mcp_tool_to_openai_function(tool)

    assert openai_fn["type"] == "function"
    fn = openai_fn["function"]
    assert fn["name"] == "get_series"
    assert fn["description"] == "Fetch downsampled time series points"
    params = fn["parameters"]
    assert params["type"] == "object"
    assert "$schema" not in params
    assert params["additionalProperties"] is False
    assert params["required"] == ["metric_key"]
    assert "metric_key" in params["properties"]
    assert "limit" in params["properties"]


def test_mcp_tool_to_openai_function_from_dict():
    raw_dict = {
        "name": "list_metrics",
        "description": "Lists all metrics",
        "inputSchema": {},
    }

    openai_fn = mcp_tool_to_openai_function(raw_dict)

    assert openai_fn["type"] == "function"
    assert openai_fn["function"]["name"] == "list_metrics"
    assert openai_fn["function"]["description"] == "Lists all metrics"
    assert openai_fn["function"]["parameters"]["type"] == "object"
    assert openai_fn["function"]["parameters"]["properties"] == {}
    assert openai_fn["function"]["parameters"]["additionalProperties"] is False
