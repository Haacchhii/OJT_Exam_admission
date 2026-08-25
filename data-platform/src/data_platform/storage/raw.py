"""Immutable Parquet raw-layer writer with per-run manifests."""

from collections.abc import Iterable, Iterator
from datetime import datetime, timedelta
from hashlib import sha256
from itertools import islice
import json
from pathlib import Path, PurePosixPath
import re
from typing import Protocol
from urllib.parse import urlsplit

import pyarrow as pa
from pyarrow import fs
import pyarrow.parquet as parquet
from pydantic import AwareDatetime, Field

from data_platform.contracts import AdmissionRecord, ContractModel
from data_platform.ingestion.admissions import ExtractionWindow


ADMISSION_PARQUET_SCHEMA = pa.schema(
    [
        pa.field("source_admission_id", pa.int64(), nullable=False),
        pa.field("grade_level", pa.string(), nullable=False),
        pa.field("level_group", pa.string()),
        pa.field("school_year", pa.string(), nullable=False),
        pa.field("applicant_type", pa.string(), nullable=False),
        pa.field("status", pa.string(), nullable=False),
        pa.field("academic_year_id", pa.int64()),
        pa.field("semester_id", pa.int64()),
        pa.field("submitted_at", pa.timestamp("us", tz="UTC"), nullable=False),
        pa.field("updated_at", pa.timestamp("us", tz="UTC"), nullable=False),
        pa.field("deleted_at", pa.timestamp("us", tz="UTC")),
    ]
)


class RawStorage(Protocol):
    def put_if_absent(self, key: str, content: bytes) -> None: ...


def _validated_key(key: str) -> PurePosixPath:
    pure_key = PurePosixPath(key)
    if not key or pure_key.is_absolute() or ".." in pure_key.parts:
        raise ValueError("unsafe object key")
    return pure_key


class RawDataObject(ContractModel):
    key: str = Field(min_length=1)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    row_count: int = Field(ge=1)


class ExtractionManifest(ContractModel):
    schema_version: int = Field(default=1, ge=1)
    pipeline: str = "admissions"
    run_id: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$")
    extracted_at: AwareDatetime
    window_start_inclusive: AwareDatetime
    window_end_inclusive: AwareDatetime
    row_count: int = Field(ge=0)
    data_objects: tuple[RawDataObject, ...]
    manifest_key: str = Field(min_length=1)


class FileRawStorage:
    """Filesystem implementation of the immutable object-storage contract."""

    def __init__(self, root: Path) -> None:
        self._root = root.resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    def path_for(self, key: str) -> Path:
        pure_key = _validated_key(key)
        target = (self._root / Path(*pure_key.parts)).resolve()
        if not target.is_relative_to(self._root):
            raise ValueError("unsafe object key")
        return target

    def put_if_absent(self, key: str, content: bytes) -> None:
        target = self.path_for(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            with target.open("xb") as file:
                file.write(content)
        except FileExistsError:
            if target.read_bytes() != content:
                raise FileExistsError(f"object already exists with different content: {key}") from None

    def read_bytes(self, key: str) -> bytes:
        return self.path_for(key).read_bytes()


class S3RawStorage:
    """S3-compatible adapter used with the SeaweedFS endpoint."""

    def __init__(self, *, filesystem: fs.FileSystem, bucket: str) -> None:
        if re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", bucket) is None:
            raise ValueError("invalid bucket name")
        self._filesystem = filesystem
        self._bucket = bucket

    @classmethod
    def connect(
        cls,
        *,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
    ) -> "S3RawStorage":
        parsed = urlsplit(endpoint)
        if (
            parsed.scheme not in {"http", "https"}
            or parsed.hostname is None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("object storage endpoint must be an HTTP(S) origin")
        filesystem = fs.S3FileSystem(
            access_key=access_key,
            secret_key=secret_key,
            scheme=parsed.scheme,
            endpoint_override=parsed.netloc,
            region="us-east-1",
            background_writes=False,
        )
        return cls(filesystem=filesystem, bucket=bucket)

    def _path(self, key: str) -> str:
        return f"{self._bucket}/{_validated_key(key).as_posix()}"

    def put_if_absent(self, key: str, content: bytes) -> None:
        path = self._path(key)
        info = self._filesystem.get_file_info(path)
        if info.type != fs.FileType.NotFound:
            with self._filesystem.open_input_stream(path) as stream:
                if stream.readall() != content:
                    raise FileExistsError(
                        f"object already exists with different content: {key}"
                    )
            return

        with self._filesystem.open_output_stream(path) as stream:
            stream.write(content)


def _batches(records: Iterable[AdmissionRecord], size: int) -> Iterator[tuple[AdmissionRecord, ...]]:
    iterator = iter(records)
    while batch := tuple(islice(iterator, size)):
        yield batch


def _serialize_parquet(records: tuple[AdmissionRecord, ...]) -> bytes:
    table = pa.Table.from_pylist(
        [record.model_dump() for record in records],
        schema=ADMISSION_PARQUET_SCHEMA,
    )
    sink = pa.BufferOutputStream()
    parquet.write_table(table, sink, compression="zstd", version="2.6")
    return sink.getvalue().to_pybytes()


def _utc_key_timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() != timedelta(0):
        raise ValueError("raw storage timestamps must be timezone-aware UTC")
    return value.strftime("%Y%m%dT%H%M%SZ")


def write_admissions_raw(
    *,
    records: Iterable[AdmissionRecord],
    storage: RawStorage,
    window: ExtractionWindow,
    run_id: str,
    extracted_at: datetime,
    part_size: int,
) -> ExtractionManifest:
    """Write immutable content-addressed Parquet parts and one run manifest."""
    if part_size < 1:
        raise ValueError("part_size must be positive")
    if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{2,127}", run_id) is None:
        raise ValueError("run_id contains unsafe characters")
    _utc_key_timestamp(extracted_at)

    partition = (
        f"admissions/extracted_date={window.end_inclusive.date().isoformat()}"
        f"/window_end={_utc_key_timestamp(window.end_inclusive)}"
    )
    objects: list[RawDataObject] = []
    row_count = 0
    for part_number, batch in enumerate(_batches(records, part_size)):
        content = _serialize_parquet(batch)
        digest = sha256(content).hexdigest()
        key = f"{partition}/part-{part_number:05d}-{digest[:16]}.parquet"
        storage.put_if_absent(key, content)
        objects.append(RawDataObject(key=key, sha256=digest, row_count=len(batch)))
        row_count += len(batch)

    manifest_key = (
        f"admissions/manifests/extracted_date={extracted_at.date().isoformat()}"
        f"/{run_id}.json"
    )
    manifest = ExtractionManifest(
        run_id=run_id,
        extracted_at=extracted_at,
        window_start_inclusive=window.start_inclusive,
        window_end_inclusive=window.end_inclusive,
        row_count=row_count,
        data_objects=tuple(objects),
        manifest_key=manifest_key,
    )
    payload = json.dumps(
        manifest.model_dump(mode="json"),
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    storage.put_if_absent(manifest_key, payload)
    return manifest
