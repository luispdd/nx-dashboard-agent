import json
from pathlib import Path

import pytest

from agent_service.config import Settings
from agent_service.security import encrypt_secret


@pytest.fixture(autouse=True)
def clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    # Clear process environment variables set by Nx or shell to test pure file resolution
    keys_to_clear = [
        "LLM_BASE_URL",
        "LLM_MODEL",
        "LLM_API_KEY",
        "RUNNING_IN_DOCKER",
        "AGENT_HOST",
        "AGENT_PORT",
        "ALLOWED_ORIGINS",
        "ALLOWED_HOSTS",
        "CHAT_RATE_LIMIT_PER_MINUTE",
        "CHAT_MAX_CONCURRENT_STREAMS",
        "CHAT_MAX_MESSAGE_CHARS",
        "CHAT_MAX_SESSIONS",
        "CHAT_SESSION_TTL_SECONDS",
        "ALLOW_INSECURE_DEV_KEY",
        "CONFIG_ENCRYPTION_KEY",
    ]
    for key in keys_to_clear:
        monkeypatch.delenv(key, raising=False)


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


def test_runtime_config_overrides_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(
        "CONFIG_ENCRYPTION_KEY", "test-key-1234567890abcdef1234567890ab"
    )
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


def test_hardening_settings_defaults() -> None:
    cfg = Settings(_env_file=None, runtime_config_path=None)
    assert cfg.agent_host == "127.0.0.1"
    assert cfg.agent_port == 8000
    assert cfg.is_loopback_only is True
    assert cfg.chat_rate_limit_per_minute == 20
    assert cfg.chat_max_concurrent_streams == 3
    assert cfg.chat_max_message_chars == 4000
    assert cfg.chat_max_sessions == 100
    assert cfg.chat_session_ttl_seconds == 3600
    assert cfg.allow_insecure_dev_key is False
    assert cfg.config_encryption_key == ""
    assert cfg.effective_allowed_origins == [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:4204",
        "http://127.0.0.1:4204",
    ]
    assert cfg.effective_allowed_hosts == [
        "localhost",
        "127.0.0.1",
        "testserver",
        "localhost:8000",
        "127.0.0.1:8000",
    ]


def test_hardening_settings_custom_env(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "AGENT_HOST=0.0.0.0\n"
        "AGENT_PORT=9000\n"
        "ALLOWED_ORIGINS=http://app.local:3000,http://dashboard.local\n"
        "ALLOWED_HOSTS=app.local,dashboard.local\n"
        "CHAT_RATE_LIMIT_PER_MINUTE=50\n"
        "CHAT_MAX_CONCURRENT_STREAMS=5\n"
        "CHAT_MAX_MESSAGE_CHARS=1000\n"
        "ALLOW_INSECURE_DEV_KEY=true\n",
        encoding="utf-8",
    )
    cfg = Settings(_env_file=env_file, runtime_config_path=None)
    assert cfg.agent_host == "0.0.0.0"
    assert cfg.agent_port == 9000
    assert cfg.is_loopback_only is False
    assert cfg.effective_allowed_origins == [
        "http://app.local:3000",
        "http://dashboard.local",
    ]
    assert cfg.effective_allowed_hosts == [
        "app.local",
        "dashboard.local",
    ]
    assert cfg.chat_rate_limit_per_minute == 50
    assert cfg.chat_max_concurrent_streams == 5
    assert cfg.chat_max_message_chars == 1000
    assert cfg.allow_insecure_dev_key is True
