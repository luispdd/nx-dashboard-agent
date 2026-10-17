import json
from pathlib import Path

import pytest

from agent_service.config import Settings
from agent_service.security import encrypt_secret


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    # Clear process environment variables set by Nx or shell to test pure file resolution
    monkeypatch.delenv("LLM_BASE_URL", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("RUNNING_IN_DOCKER", raising=False)


def test_empty_settings_without_env_or_config() -> None:
    # When no .env file and no runtime-config.json exists, variables must not have hardcoded values
    cfg = Settings(_env_file=None, runtime_config_path=None)
    assert cfg.llm_base_url == ""
    assert cfg.llm_model == ""
    assert cfg.llm_api_key == ""


def test_settings_loaded_from_env_file(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "LLM_BASE_URL=http://localhost:11434/v1\nLLM_MODEL=llama3.2\nLLM_API_KEY=test-env-key\n",
        encoding="utf-8",
    )
    cfg = Settings(_env_file=env_file, runtime_config_path=None)
    assert cfg.llm_base_url == "http://localhost:11434/v1"
    assert cfg.llm_model == "llama3.2"
    assert cfg.llm_api_key == "test-env-key"


def test_runtime_config_overrides_env(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "LLM_BASE_URL=http://localhost:11434/v1\nLLM_MODEL=llama3.2\nLLM_API_KEY=test-env-key\n",
        encoding="utf-8",
    )
    config_file = tmp_path / "runtime-config.json"
    encrypted_key = encrypt_secret("sk-secret-test-key-999")

    payload = {
        "llm": {
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
            "api_key_encrypted": encrypted_key,
        },
        "updated_at": "2026-10-14T10:00:00Z",
    }
    config_file.write_text(json.dumps(payload), encoding="utf-8")

    cfg = Settings(_env_file=env_file, runtime_config_path=str(config_file))
    assert cfg.llm_base_url == "https://api.openai.com/v1"
    assert cfg.llm_model == "gpt-4o-mini"
    assert cfg.llm_api_key == "sk-secret-test-key-999"


def test_runtime_config_partial_override(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "LLM_BASE_URL=http://localhost:11434/v1\nLLM_MODEL=llama3.2\n",
        encoding="utf-8",
    )
    config_file = tmp_path / "runtime-config.json"
    payload = {
        "llm": {
            "model": "qwen2.5-coder-7b",
        }
    }
    config_file.write_text(json.dumps(payload), encoding="utf-8")

    cfg = Settings(_env_file=env_file, runtime_config_path=str(config_file))
    # Model is overridden from runtime-config
    assert cfg.llm_model == "qwen2.5-coder-7b"
    # Base URL remains what was loaded from .env
    assert cfg.llm_base_url == "http://localhost:11434/v1"


def test_runtime_config_malformed_json_fallback(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "LLM_BASE_URL=http://localhost:11434/v1\n",
        encoding="utf-8",
    )
    config_file = tmp_path / "runtime-config.json"
    config_file.write_text("{ broken json ...", encoding="utf-8")

    cfg = Settings(_env_file=env_file, runtime_config_path=str(config_file))
    # Should not crash and should keep env fallback
    assert cfg.llm_base_url == "http://localhost:11434/v1"


def test_docker_url_normalization() -> None:
    from agent_service.config import normalize_docker_url

    assert (
        normalize_docker_url("http://127.0.0.1:8888/v1", running_in_docker=True)
        == "http://host.docker.internal:8888/v1"
    )
    assert (
        normalize_docker_url("http://localhost:8888/v1", running_in_docker=True)
        == "http://host.docker.internal:8888/v1"
    )
    assert (
        normalize_docker_url("http://127.0.0.1:8888/v1", running_in_docker=False)
        == "http://127.0.0.1:8888/v1"
    )
    assert (
        normalize_docker_url("https://api.openai.com/v1", running_in_docker=True)
        == "https://api.openai.com/v1"
    )


def test_settings_normalizes_url_in_docker(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "LLM_BASE_URL=http://127.0.0.1:8888/v1\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("RUNNING_IN_DOCKER", "true")
    cfg = Settings(_env_file=env_file, runtime_config_path=None)
    assert cfg.running_in_docker is True
    assert cfg.llm_base_url == "http://host.docker.internal:8888/v1"


def test_settings_preserves_url_when_not_in_docker(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "LLM_BASE_URL=http://127.0.0.1:8888/v1\n",
        encoding="utf-8",
    )
    cfg = Settings(_env_file=env_file, runtime_config_path=None)
    assert cfg.running_in_docker is False
    assert cfg.llm_base_url == "http://127.0.0.1:8888/v1"

