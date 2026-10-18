"""Adapter converting Model Context Protocol (MCP) tool schemas into OpenAI function calling schemas."""

from typing import Any

from mcp.types import Tool


def normalize_schema_dict(schema: dict[str, Any]) -> dict[str, Any]:
    """Recursively normalizes a JSON schema dictionary for OpenAI-compatible LLM runners.

    Strips JSON Schema meta-keywords ($schema, $id, $defs, definitions) and
    enforces type='object' and additionalProperties=False on object schemas.
    """
    cleaned = dict(schema)

    # Strip metadata keywords that confuse small local LLMs
    for keyword in ("$schema", "$id", "$defs", "definitions", "title"):
        cleaned.pop(keyword, None)

    # If it is or defines an object schema
    if cleaned.get("type") == "object" or "properties" in cleaned:
        cleaned["type"] = "object"
        cleaned.setdefault("properties", {})
        cleaned["additionalProperties"] = False

        if isinstance(cleaned["properties"], dict):
            new_properties = {}
            for prop_name, prop_val in cleaned["properties"].items():
                if isinstance(prop_val, dict):
                    new_properties[prop_name] = normalize_schema_dict(prop_val)
                else:
                    new_properties[prop_name] = prop_val
            cleaned["properties"] = new_properties

    # Normalize nested array items if they are schema dicts
    if cleaned.get("type") == "array" and isinstance(cleaned.get("items"), dict):
        cleaned["items"] = normalize_schema_dict(cleaned["items"])

    return cleaned


def mcp_tool_to_openai_function(tool: Tool | dict[str, Any]) -> dict[str, Any]:
    """Converts an MCP tool definition into an OpenAI function tool specification."""
    if hasattr(tool, "name"):
        name = str(tool.name)
        description = str(getattr(tool, "description", "") or "")
        input_schema = getattr(tool, "input_schema", {}) or {}
    else:
        name = str(tool.get("name", ""))
        description = str(tool.get("description", "") or "")
        input_schema = tool.get("input_schema") or tool.get("inputSchema") or {}

    raw_schema = input_schema if isinstance(input_schema, dict) else {}
    parameters = normalize_schema_dict(raw_schema)
    parameters["type"] = "object"
    parameters.setdefault("properties", {})
    parameters["additionalProperties"] = False

    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": parameters,
        },
    }
