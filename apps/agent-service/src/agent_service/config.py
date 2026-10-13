from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    llm_base_url: str = "http://127.0.0.1:8888/v1"
    llm_model: str = "unsloth/Qwen3.5-4B-GGUF"
    llm_api_key: str = ""


settings = Settings()
