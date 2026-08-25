"""Admissions extraction-to-raw pipeline composition."""

from datetime import datetime, timedelta

from data_platform.ingestion.admissions import (
    AdmissionsSource,
    ExtractionWindow,
    extract_incrementally,
)
from data_platform.storage.raw import (
    ExtractionManifest,
    RawStorage,
    write_admissions_raw,
)


def run_admissions_extract(
    *,
    source: AdmissionsSource,
    storage: RawStorage,
    previous_watermark: datetime,
    until: datetime,
    lookback: timedelta,
    batch_size: int,
    part_size: int,
    run_id: str,
    extracted_at: datetime,
) -> ExtractionManifest:
    window = ExtractionWindow.from_watermark(
        previous_watermark=previous_watermark,
        until=until,
        lookback=lookback,
    )
    records = extract_incrementally(
        source=source,
        window=window,
        batch_size=batch_size,
    )
    return write_admissions_raw(
        records=records,
        storage=storage,
        window=window,
        run_id=run_id,
        extracted_at=extracted_at,
        part_size=part_size,
    )
