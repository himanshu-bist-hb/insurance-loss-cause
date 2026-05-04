from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List
import os


class Settings(BaseSettings):
    # Azure OpenAI
    azure_openai_api_key: str = Field(default="", env="AZURE_OPENAI_API_KEY")
    azure_openai_endpoint: str = Field(default="", env="AZURE_OPENAI_ENDPOINT")
    azure_openai_deployment_name: str = Field(default="gpt-4o", env="AZURE_OPENAI_DEPLOYMENT_NAME")
    azure_openai_api_version: str = Field(default="2024-08-01-preview", env="AZURE_OPENAI_API_VERSION")

    # App
    app_env: str = Field(default="development", env="APP_ENV")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        env="CORS_ORIGINS"
    )

    # File storage
    upload_dir: str = Field(default="./uploads", env="UPLOAD_DIR")
    max_file_size_mb: int = Field(default=50, env="MAX_FILE_SIZE_MB")

    # Default taxonomy overrides — set to a CSV/Excel/JSON file path to replace the built-in taxonomy
    taxonomy_excess_and_surplus_path: str = Field(default="", env="TAXONOMY_EXCESS_AND_SURPLUS_PATH")
    taxonomy_auto_path: str = Field(default="", env="TAXONOMY_AUTO_PATH")

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
