from datetime import UTC, datetime, timedelta

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
            if window.start_inclusive <= row.updated_at <= window.end_inclusive
            and (after is None or (row.updated_at, row.source_admission_id) > after)
        )
        return tuple(sorted(eligible, key=lambda row: (row.updated_at, row.source_admission_id)))[:limit]


def test_pipeline_composes_incremental_extraction_and_raw_storage(tmp_path) -> None:
    records = generate_admissions_dataset(seed=2026, admission_count=12).admissions
    previous_watermark = min(row.updated_at for row in records) + timedelta(minutes=1)
    until = max(row.updated_at for row in records)

    manifest = run_admissions_extract(
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
        previous_watermark - timedelta(minutes=5) <= row.updated_at <= until
        for row in records
    )
    assert manifest.row_count == expected_count
    assert sum(part.row_count for part in manifest.data_objects) == expected_count
