from datetime import UTC, datetime, timedelta
import json

import pyarrow.parquet as parquet

from data_platform.pipelines.admissions import run_admissions_extract
from data_platform.storage.raw import FileRawStorage
from data_platform.synthetic import generate_admissions_dataset


class InMemorySource:
    def __init__(self, records):
        self.records = records

    def fetch_batch(self, *, window, after, limit):
        eligible = (
            row
            for row in self.records
            if window.start_inclusive <= row["updated_at"] <= window.end_inclusive
            and (
                after is None
                or (row["updated_at"], row["source_admission_id"]) > after
            )
        )
        return tuple(
            sorted(
                eligible,
                key=lambda row: (row["updated_at"], row["source_admission_id"]),
            )
        )[:limit]


def test_pipeline_composes_incremental_extraction_and_raw_storage(tmp_path) -> None:
    records = tuple(
        row.model_dump()
        for row in generate_admissions_dataset(seed=2026, admission_count=12).admissions
    )
    previous_watermark = min(row["updated_at"] for row in records) + timedelta(minutes=1)
    until = max(row["updated_at"] for row in records)

    result = run_admissions_extract(
        source=InMemorySource(records),
        storage=FileRawStorage(tmp_path),
        previous_watermark=previous_watermark,
        until=until,
        lookback=timedelta(minutes=5),
        batch_size=3,
        part_size=4,
        run_id="run-composed-pipeline",
        extracted_at=datetime(2026, 8, 25, tzinfo=UTC),
    )

    expected_count = sum(
        previous_watermark - timedelta(minutes=5) <= row["updated_at"] <= until
        for row in records
    )
    assert result.raw_manifest.row_count == expected_count
    assert result.reconciliation.extracted_count == expected_count
    assert result.reconciliation.accepted_count == expected_count
    assert result.reconciliation.rejected_count == 0


def test_pipeline_quarantines_invalid_rows_and_reconciles_the_run(tmp_path) -> None:
    records = [
        row.model_dump()
        for row in generate_admissions_dataset(seed=2026, admission_count=5).admissions
    ]
    records[1]["status"] = "Approved"
    records[3]["grade_level"] = ""
    storage = FileRawStorage(tmp_path)

    result = run_admissions_extract(
        source=InMemorySource(records),
        storage=storage,
        previous_watermark=min(row["updated_at"] for row in records),
        until=max(row["updated_at"] for row in records),
        lookback=timedelta(0),
        batch_size=2,
        part_size=2,
        run_id="run-with-rejections",
        extracted_at=datetime(2026, 8, 27, tzinfo=UTC),
    )

    assert result.raw_manifest.row_count == 3
    assert result.reconciliation.extracted_count == 5
    assert result.reconciliation.accepted_count == 3
    assert result.reconciliation.rejected_count == 2
    accepted_source_ids = {
        row["source_admission_id"]
        for data_object in result.raw_manifest.data_objects
        for row in parquet.ParquetFile(storage.path_for(data_object.key)).read().to_pylist()
    }
    assert accepted_source_ids == {
        row["source_admission_id"] for index, row in enumerate(records) if index not in {1, 3}
    }
    quarantine_lines = storage.read_bytes(result.quality_artifacts.quarantine_key).splitlines()
    quarantined = [json.loads(line) for line in quarantine_lines]
    assert {row["pipeline_run_id"] for row in quarantined} == {"run-with-rejections"}
    assert all(row["issues"] for row in quarantined)
    assert json.loads(storage.read_bytes(result.quality_artifacts.reconciliation_key))[
        "rejected_count"
    ] == 2
