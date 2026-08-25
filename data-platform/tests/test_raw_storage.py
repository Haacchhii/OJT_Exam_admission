import json
from datetime import UTC, datetime

import pyarrow.parquet as parquet
from pyarrow import fs
import pytest

from data_platform.storage import raw
from data_platform.ingestion.admissions import ExtractionWindow
from data_platform.storage.raw import FileRawStorage, S3RawStorage, write_admissions_raw
from data_platform.synthetic import generate_admissions_dataset


def test_raw_writer_creates_partitioned_parquet_and_a_run_manifest(tmp_path) -> None:
    records = generate_admissions_dataset(seed=2026, admission_count=7).admissions
    storage = FileRawStorage(tmp_path)
    window = ExtractionWindow(
        start_inclusive=datetime(2026, 6, 1, tzinfo=UTC),
        end_inclusive=datetime(2026, 6, 2, tzinfo=UTC),
    )

    manifest = write_admissions_raw(
        records=iter(records),
        storage=storage,
        window=window,
        run_id="run-20260602-001",
        extracted_at=datetime(2026, 6, 2, 0, 1, tzinfo=UTC),
        part_size=3,
    )

    assert manifest.row_count == 7
    assert [part.row_count for part in manifest.data_objects] == [3, 3, 1]
    assert all(
        part.key.startswith("admissions/extracted_date=2026-06-02/window_end=20260602T000000Z/")
        and part.key.endswith(".parquet")
        for part in manifest.data_objects
    )
    manifest_payload = json.loads(storage.read_bytes(manifest.manifest_key))
    assert manifest_payload["run_id"] == "run-20260602-001"
    assert manifest_payload["row_count"] == 7
    assert len(manifest_payload["data_objects"]) == 3


def test_parquet_round_trip_contains_only_contract_fields(tmp_path) -> None:
    records = generate_admissions_dataset(seed=2026, admission_count=2).admissions
    storage = FileRawStorage(tmp_path)
    manifest = write_admissions_raw(
        records=iter(records),
        storage=storage,
        window=ExtractionWindow(
            start_inclusive=datetime(2026, 6, 1, tzinfo=UTC),
            end_inclusive=datetime(2026, 6, 2, tzinfo=UTC),
        ),
        run_id="run-round-trip",
        extracted_at=datetime(2026, 6, 2, tzinfo=UTC),
        part_size=100,
    )

    table = parquet.read_table(storage.path_for(manifest.data_objects[0].key))
    assert table.to_pylist() == [record.model_dump() for record in records]
    assert not {
        "tracking_id",
        "first_name",
        "last_name",
        "email",
        "phone",
        "dob",
        "lrn",
        "guardian",
        "notes",
    } & set(table.column_names)


def test_rerunning_an_interval_reuses_identical_logical_data_objects(tmp_path) -> None:
    records = generate_admissions_dataset(seed=2026, admission_count=5).admissions
    storage = FileRawStorage(tmp_path)
    window = ExtractionWindow(
        start_inclusive=datetime(2026, 6, 1, tzinfo=UTC),
        end_inclusive=datetime(2026, 6, 2, tzinfo=UTC),
    )

    first = write_admissions_raw(
        records=iter(records),
        storage=storage,
        window=window,
        run_id="run-first",
        extracted_at=datetime(2026, 6, 2, 0, 1, tzinfo=UTC),
        part_size=2,
    )
    rerun = write_admissions_raw(
        records=iter(records),
        storage=storage,
        window=window,
        run_id="run-rerun",
        extracted_at=datetime(2026, 6, 2, 0, 2, tzinfo=UTC),
        part_size=2,
    )

    assert [(part.key, part.sha256, part.row_count) for part in first.data_objects] == [
        (part.key, part.sha256, part.row_count) for part in rerun.data_objects
    ]
    assert first.manifest_key != rerun.manifest_key


def test_file_storage_rejects_conflicting_overwrite_and_unsafe_keys(tmp_path) -> None:
    storage = FileRawStorage(tmp_path)
    storage.put_if_absent("admissions/safe.bin", b"first")
    storage.put_if_absent("admissions/safe.bin", b"first")

    with pytest.raises(FileExistsError, match="different content"):
        storage.put_if_absent("admissions/safe.bin", b"second")
    with pytest.raises(ValueError, match="unsafe object key"):
        storage.put_if_absent("../outside.bin", b"content")


class MemoryOutputStream:
    def __init__(self, objects, path):
        self.objects = objects
        self.path = path
        self.content = bytearray()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.objects[self.path] = bytes(self.content)

    def write(self, content):
        self.content.extend(content)


class MemoryS3FileSystem:
    def __init__(self):
        self.objects = {}

    def get_file_info(self, path):
        file_type = fs.FileType.File if path in self.objects else fs.FileType.NotFound
        return fs.FileInfo(path, file_type)

    def open_input_stream(self, path):
        return InputBytes(self.objects[path])

    def open_output_stream(self, path):
        return MemoryOutputStream(self.objects, path)


class InputBytes:
    def __init__(self, content):
        self.content = content

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def readall(self):
        return self.content


def test_s3_storage_prefixes_bucket_and_preserves_immutable_objects() -> None:
    filesystem = MemoryS3FileSystem()
    storage = S3RawStorage(filesystem=filesystem, bucket="goldenkey-raw")

    storage.put_if_absent("admissions/part.parquet", b"content")
    storage.put_if_absent("admissions/part.parquet", b"content")

    assert filesystem.objects == {"goldenkey-raw/admissions/part.parquet": b"content"}
    with pytest.raises(FileExistsError, match="different content"):
        storage.put_if_absent("admissions/part.parquet", b"changed")


def test_s3_storage_connects_to_an_s3_compatible_endpoint(monkeypatch) -> None:
    captured = {}

    def fake_s3_filesystem(**kwargs):
        captured.update(kwargs)
        return MemoryS3FileSystem()

    monkeypatch.setattr(raw.fs, "S3FileSystem", fake_s3_filesystem)
    storage = S3RawStorage.connect(
        endpoint="http://seaweedfs:8333",
        access_key="local-user",
        secret_key="local-password",
        bucket="goldenkey-raw",
    )
    storage.put_if_absent("admissions/test.bin", b"content")

    assert captured == {
        "access_key": "local-user",
        "secret_key": "local-password",
        "scheme": "http",
        "endpoint_override": "seaweedfs:8333",
        "region": "us-east-1",
        "background_writes": False,
    }
