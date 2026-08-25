"""Validated configuration for the GoldenKey data platform."""

from typing import Literal, Self
from urllib.parse import urlsplit

from pydantic import (
    AnyHttpUrl,
    Field,
    PostgresDsn,
    SecretStr,
    StringConstraints,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated


EnvironmentName = Literal["development", "test", "production"]
BucketName = Annotated[
    str,
    StringConstraints(
        min_length=3,
        max_length=63,
        pattern=r"^[a-z0-9][a-z0-9.-]*[a-z0-9]$",
    ),
]


class DataPlatformSettings(BaseSettings):
    """Fail-closed settings loaded from environment variables or a local file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
        populate_by_name=True,
    )

    environment: EnvironmentName = Field(
        default="development",
        validation_alias="DATA_PLATFORM_ENV",
    )
    source_database_url: PostgresDsn = Field(
        validation_alias="SOURCE_DATABASE_URL",
    )
    warehouse_database_url: PostgresDsn = Field(
        validation_alias="WAREHOUSE_DATABASE_URL",
    )
    object_storage_endpoint: AnyHttpUrl = Field(
        validation_alias="OBJECT_STORAGE_ENDPOINT",
    )
    object_storage_access_key: SecretStr = Field(
        min_length=3,
        validation_alias="OBJECT_STORAGE_ACCESS_KEY",
    )
    object_storage_secret_key: SecretStr = Field(
        min_length=8,
        validation_alias="OBJECT_STORAGE_SECRET_KEY",
    )
    object_storage_bucket: BucketName = Field(
        default="goldenkey-raw",
        validation_alias="OBJECT_STORAGE_BUCKET",
    )
    pipeline_batch_size: int = Field(
        default=1000,
        ge=1,
        le=100_000,
        validation_alias="PIPELINE_BATCH_SIZE",
    )
    pipeline_lookback_minutes: int = Field(
        default=5,
        ge=0,
        le=1440,
        validation_alias="PIPELINE_LOOKBACK_MINUTES",
    )

    @model_validator(mode="after")
    def enforce_database_separation(self) -> Self:
        source = urlsplit(str(self.source_database_url))
        warehouse = urlsplit(str(self.warehouse_database_url))

        source_database = (source.hostname, source.path.rstrip("/"))
        warehouse_database = (warehouse.hostname, warehouse.path.rstrip("/"))
        if source_database == warehouse_database:
            raise ValueError(
                "source and warehouse must be different PostgreSQL databases"
            )

        if self.environment == "production":
            username = (source.username or "").lower()
            read_only_markers = ("reader", "readonly", "read_only")
            if not any(marker in username for marker in read_only_markers):
                raise ValueError(
                    "production source must use a clearly named read-only database role"
                )

        return self
