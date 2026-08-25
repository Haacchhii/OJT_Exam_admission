"""Incremental, privacy-safe admissions extraction from PostgreSQL."""

from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol, TypeAlias

from psycopg import Connection
from psycopg.rows import dict_row

from data_platform.contracts import AdmissionRecord, extract_admission_record


PageCursor: TypeAlias = tuple[datetime, int]


def _is_utc(value: datetime) -> bool:
    return value.tzinfo is not None and value.utcoffset() == timedelta(0)


@dataclass(frozen=True)
class ExtractionWindow:
    start_inclusive: datetime
    end_inclusive: datetime

    def __post_init__(self) -> None:
        if not _is_utc(self.start_inclusive) or not _is_utc(self.end_inclusive):
            raise ValueError("extraction window timestamps must be timezone-aware UTC")
        if self.end_inclusive < self.start_inclusive:
            raise ValueError("end_inclusive must not precede start_inclusive")

    @classmethod
    def from_watermark(
        cls,
        *,
        previous_watermark: datetime,
        until: datetime,
        lookback: timedelta,
    ) -> "ExtractionWindow":
        if lookback < timedelta(0):
            raise ValueError("lookback must not be negative")
        return cls(
            start_inclusive=previous_watermark - lookback,
            end_inclusive=until,
        )


class AdmissionsSource(Protocol):
    def fetch_batch(
        self,
        *,
        window: ExtractionWindow,
        after: PageCursor | None,
        limit: int,
    ) -> Sequence[AdmissionRecord]: ...


class PostgresAdmissionsSource:
    """Read approved admission columns using keyset pagination."""

    _COLUMNS = """
        id, grade_level, level_group, school_year, applicant_type, status,
        academic_year_id, semester_id,
        submitted_at AT TIME ZONE 'UTC' AS submitted_at,
        updated_at AT TIME ZONE 'UTC' AS updated_at,
        deleted_at AT TIME ZONE 'UTC' AS deleted_at
    """

    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def fetch_batch(
        self,
        *,
        window: ExtractionWindow,
        after: PageCursor | None,
        limit: int,
    ) -> tuple[AdmissionRecord, ...]:
        if limit < 1:
            raise ValueError("limit must be positive")

        cursor_filter = ""
        params: tuple[object, ...]
        if after is None:
            params = (window.start_inclusive, window.end_inclusive, limit)
        else:
            cursor_filter = "AND (updated_at, id) > ((%s AT TIME ZONE 'UTC'), %s)"
            params = (
                window.start_inclusive,
                window.end_inclusive,
                after[0],
                after[1],
                limit,
            )

        query = f"""
            SELECT {self._COLUMNS}
            FROM admissions
            WHERE updated_at >= (%s AT TIME ZONE 'UTC')
              AND updated_at <= (%s AT TIME ZONE 'UTC')
              {cursor_filter}
            ORDER BY updated_at ASC, id ASC
            LIMIT %s
        """
        with self._connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(query, params)
            return tuple(extract_admission_record(row) for row in cursor.fetchall())


def extract_incrementally(
    *,
    source: AdmissionsSource,
    window: ExtractionWindow,
    batch_size: int,
) -> Iterator[AdmissionRecord]:
    """Stream one stable, bounded keyset page at a time."""
    if batch_size < 1:
        raise ValueError("batch_size must be positive")

    after: PageCursor | None = None
    while True:
        batch = tuple(source.fetch_batch(window=window, after=after, limit=batch_size))
        if len(batch) > batch_size:
            raise ValueError("source returned more records than the requested batch size")
        if not batch:
            return

        cursors = tuple((row.updated_at, row.source_admission_id) for row in batch)
        if cursors != tuple(sorted(cursors)) or (after is not None and cursors[0] <= after):
            raise ValueError("source batch is not in strictly advancing keyset order")
        if len(set(cursors)) != len(cursors):
            raise ValueError("source batch contains duplicate pagination keys")

        yield from batch
        after = cursors[-1]
        if len(batch) < batch_size:
            return
