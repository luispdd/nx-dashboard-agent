import json
import logging
import os
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict

from agent_service.security import decrypt_secret

logger = logging.getLogger(__name__)


def find_repo_root() -> Path:
    current = Path(__file__).resolve().parent
    for parent in [current, *current.parents]:
        if (parent / "nx.json").is_file() or (parent / ".git").is_dir():
            return parent
    return Path.cwd()


def find_runtime_config_path(custom_path: Path | str | None = None) -> Path | None:
    if custom_path:
        p = Path(custom_path)
        return p if p.is_file() else None

    env_path = os.getenv("RUNTIME_CONFIG_PATH")
    if env_path:
        p = Path(env_path)
        return p if p.is_file() else None

    cwd_p = Path("data/runtime-config.json")
    if cwd_p.is_file():
        return cwd_p

    # Path relative to repository root
    repo_p = find_repo_root() / "data" / "runtime-config.json"
    if repo_p.is_file():
        return repo_p

    return None


def normalize_docker_url(url: str, running_in_docker: bool = False) -> str:
    if not running_in_docker or not url:
        return url
    normalized = url.replace("://127.0.0.1", "://host.docker.internal")
    normalized = normalized.replace("://localhost", "://host.docker.internal")
    return normalized


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(find_repo_root() / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    llm_base_url: str = ""
    llm_model: str = ""
    llm_api_key: str = ""
    dashboard_api_url: str = "http://localhost:3000"
    runtime_config_path: str | None = None
    running_in_docker: bool = False
    log_payloads: bool = False

    def model_post_init(self, context: Any, /) -> None:
        super().model_post_init(context)
        self.apply_runtime_config()
        in_docker = self.running_in_docker or os.getenv("RUNNING_IN_DOCKER", "").lower() in (
            "true",
            "1",
            "yes",
        )
        if in_docker:
            self.running_in_docker = True
            self.llm_base_url = normalize_docker_url(
                self.llm_base_url, running_in_docker=True
            )

    def apply_runtime_config(self) -> None:
        target_path = find_runtime_config_path(self.runtime_config_path)
        if not target_path or not target_path.is_file():
            return

        try:
            with open(target_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            llm_config = data.get("llm", {})
            if llm_config.get("base_url"):
                self.llm_base_url = str(llm_config["base_url"])
            if llm_config.get("model"):
                self.llm_model = str(llm_config["model"])

            encrypted_key = llm_config.get("api_key_encrypted") or llm_config.get(
                "api_key"
            )
            if encrypted_key:
                self.llm_api_key = decrypt_secret(str(encrypted_key))

            log_config = data.get("logging", {})
            if "log_payloads" in log_config:
                self.log_payloads = bool(log_config["log_payloads"])
        except Exception as err:  # noqa: BLE001
            logger.warning(
                "Failed to load runtime configuration from %s: %s", target_path, err
            )


def get_settings(runtime_config_path: str | Path | None = None) -> Settings:
    return Settings(
        runtime_config_path=str(runtime_config_path) if runtime_config_path else None
    )


settings = Settings()
