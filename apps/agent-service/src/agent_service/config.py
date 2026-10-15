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


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", str(find_repo_root() / "apps" / "agent-service" / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    llm_base_url: str = ""
    llm_model: str = ""
    llm_api_key: str = ""
    runtime_config_path: str | None = None

    def model_post_init(self, context: Any, /) -> None:
        super().model_post_init(context)
        self.apply_runtime_config()

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
        except Exception as err:  # noqa: BLE001
            logger.warning(
                "Failed to load runtime configuration from %s: %s", target_path, err
            )


def get_settings(runtime_config_path: str | Path | None = None) -> Settings:
    return Settings(
        runtime_config_path=str(runtime_config_path) if runtime_config_path else None
    )


settings = Settings()
