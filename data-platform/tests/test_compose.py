from pathlib import Path
import json

import yaml


COMPOSE_FILE = Path(__file__).resolve().parents[1] / "docker-compose.yml"
ENV_EXAMPLE_FILE = COMPOSE_FILE.parent / ".env.example"
S3_CONFIG_FILE = COMPOSE_FILE.parent / "seaweedfs" / "s3.json"


def load_compose() -> dict:
    return yaml.safe_load(COMPOSE_FILE.read_text(encoding="utf-8"))


def test_defines_isolated_source_warehouse_and_object_storage() -> None:
    compose = load_compose()

    assert set(compose["services"]) == {"source-db", "warehouse-db", "seaweedfs"}
    assert compose["services"]["source-db"]["image"].startswith("postgres:17.")
    assert compose["services"]["warehouse-db"]["image"].startswith("postgres:17.")
    assert compose["services"]["seaweedfs"]["image"] == "chrislusf/seaweedfs:4.41"


def test_every_service_has_healthcheck_and_restart_policy() -> None:
    compose = load_compose()

    for service in compose["services"].values():
        assert service["healthcheck"]["test"]
        assert service["restart"] == "unless-stopped"


def test_stateful_services_use_distinct_named_volumes() -> None:
    compose = load_compose()

    source_mount = compose["services"]["source-db"]["volumes"][0]
    warehouse_mount = compose["services"]["warehouse-db"]["volumes"][0]
    object_mount = compose["services"]["seaweedfs"]["volumes"][0]

    assert source_mount.startswith("source-db-data:")
    assert warehouse_mount.startswith("warehouse-db-data:")
    assert object_mount.startswith("seaweedfs-data:")
    assert set(compose["volumes"]) == {
        "source-db-data",
        "warehouse-db-data",
        "seaweedfs-data",
    }


def test_host_ports_bind_only_to_loopback() -> None:
    compose = load_compose()

    for service in compose["services"].values():
        for published_port in service.get("ports", []):
            assert str(published_port).startswith("127.0.0.1:")


def test_services_share_only_the_data_platform_network() -> None:
    compose = load_compose()

    for service in compose["services"].values():
        assert service["networks"] == ["data-platform"]
    assert set(compose["networks"]) == {"data-platform"}


def test_s3_credentials_are_matching_local_placeholders() -> None:
    example_values = {
        key: value
        for key, value in (
            line.split("=", maxsplit=1)
            for line in ENV_EXAMPLE_FILE.read_text(encoding="utf-8").splitlines()
            if line and not line.startswith("#")
        )
    }
    s3_config = json.loads(S3_CONFIG_FILE.read_text(encoding="utf-8"))
    credentials = s3_config["identities"][0]["credentials"][0]

    assert credentials["accessKey"] == example_values["OBJECT_STORAGE_ACCESS_KEY"]
    assert credentials["secretKey"] == example_values["OBJECT_STORAGE_SECRET_KEY"]
    assert credentials["accessKey"].startswith("local-")
    assert credentials["secretKey"].startswith("local-")
