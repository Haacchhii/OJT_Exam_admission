from collections.abc import Mapping
from pathlib import Path

import pytest
from pydantic import ValidationError

from data_platform.config import DataPlatformSettings


def valid_environment() -> dict[str, str]:
    return {
        "DATA_PLATFORM_ENV": "development",
        "SOURCE_DATABASE_URL": (
            "postgresql://goldenkey_reader:source-password@source-db:5432/"
            "goldenkey_source"
        ),
        "WAREHOUSE_DATABASE_URL": (
            "postgresql://goldenkey_warehouse:warehouse-password@warehouse-db:5432/"
            "goldenkey_warehouse"
        ),
        "OBJECT_STORAGE_ENDPOINT": "http://seaweedfs:8333",
        "OBJECT_STORAGE_ACCESS_KEY": "local-seaweedfs-user",
        "OBJECT_STORAGE_SECRET_KEY": "local-seaweedfs-password",
        "OBJECT_STORAGE_BUCKET": "goldenkey-raw",
        "PIPELINE_BATCH_SIZE": "1000",
        "PIPELINE_LOOKBACK_MINUTES": "5",
    }


def settings_from(values: Mapping[str, str]) -> DataPlatformSettings:
    return DataPlatformSettings(_env_file=None, **values)


def test_accepts_valid_local_configuration() -> None:
    settings = settings_from(valid_environment())

    assert settings.environment == "development"
    assert settings.pipeline_batch_size == 1000
    assert settings.pipeline_lookback_minutes == 5


def test_committed_example_file_is_valid() -> None:
    example_file = Path(__file__).resolve().parents[1] / ".env.example"

    settings = DataPlatformSettings(_env_file=example_file)

    assert settings.environment == "development"
    assert settings.source_database_url.hosts()[0]["host"] == "source-db"


@pytest.mark.parametrize(
    "missing_key",
    [
        "SOURCE_DATABASE_URL",
        "WAREHOUSE_DATABASE_URL",
        "OBJECT_STORAGE_ENDPOINT",
        "OBJECT_STORAGE_ACCESS_KEY",
        "OBJECT_STORAGE_SECRET_KEY",
    ],
)
def test_rejects_missing_required_configuration(missing_key: str) -> None:
    values = valid_environment()
    del values[missing_key]

    with pytest.raises(ValidationError):
        settings_from(values)


def test_rejects_source_and_warehouse_pointing_to_same_database() -> None:
    values = valid_environment()
    values["WAREHOUSE_DATABASE_URL"] = values["SOURCE_DATABASE_URL"]

    with pytest.raises(ValidationError, match="different PostgreSQL databases"):
        settings_from(values)


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("SOURCE_DATABASE_URL", "mysql://reader:password@db/source"),
        ("WAREHOUSE_DATABASE_URL", "not-a-url"),
        ("OBJECT_STORAGE_ENDPOINT", "ftp://minio:9000"),
        ("OBJECT_STORAGE_BUCKET", "Invalid_Bucket_Name"),
        ("PIPELINE_BATCH_SIZE", "0"),
        ("PIPELINE_LOOKBACK_MINUTES", "-1"),
    ],
)
def test_rejects_malformed_or_out_of_range_values(key: str, value: str) -> None:
    values = valid_environment()
    values[key] = value

    with pytest.raises(ValidationError):
        settings_from(values)


def test_production_source_requires_reader_named_database_role() -> None:
    values = valid_environment()
    values["DATA_PLATFORM_ENV"] = "production"
    values["SOURCE_DATABASE_URL"] = (
        "postgresql://postgres:production-password@db.example.com:5432/postgres"
    )

    with pytest.raises(ValidationError, match="read-only database role"):
        settings_from(values)


def test_validation_errors_do_not_expose_database_passwords() -> None:
    values = valid_environment()
    values["WAREHOUSE_DATABASE_URL"] = values["SOURCE_DATABASE_URL"]

    with pytest.raises(ValidationError) as error:
        settings_from(values)

    assert "source-password" not in str(error.value)
