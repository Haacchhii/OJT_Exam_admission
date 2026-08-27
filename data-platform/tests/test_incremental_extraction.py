from datetime import UTC, datetime, timedelta

import pytest

from data_platform.ingestion.admissions import (
    ExtractionWindow,
    PostgresAdmissionsSource,
    extract_incrementally,
)
from data_platform.synthetic import generate_admissions_dataset


class InMemoryAdmissionsSource:
    def __init__(self, rows):
        self.rows = list(rows)
        self.requested_limits: list[int] = []

    def fetch_batch(self, *, window, after, limit):
        self.requested_limits.append(limit)
        rows = [
            row
            for row in self.rows
            if window.start_inclusive <= row["updated_at"] <= window.end_inclusive
            and (
                after is None
                or (row["updated_at"], row["source_admission_id"]) > after
            )
        ]
        return sorted(rows, key=lambda row: (row["updated_at"], row["source_admission_id"]))[:limit]


def test_window_applies_utc_lookback_to_the_previous_watermark() -> None:
    watermark = datetime(2026, 6, 1, 10, 0, tzinfo=UTC)
    until = datetime(2026, 6, 1, 10, 5, tzinfo=UTC)

    window = ExtractionWindow.from_watermark(
        previous_watermark=watermark,
        until=until,
        lookback=timedelta(minutes=5),
    )

    assert window.start_inclusive == datetime(2026, 6, 1, 9, 55, tzinfo=UTC)
    assert window.end_inclusive == until


def test_window_rejects_naive_or_reversed_timestamps() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        ExtractionWindow.from_watermark(
            previous_watermark=datetime(2026, 6, 1, 10, 0),
            until=datetime(2026, 6, 1, 10, 5, tzinfo=UTC),
            lookback=timedelta(minutes=5),
        )

    with pytest.raises(ValueError, match="must not precede"):
        ExtractionWindow.from_watermark(
            previous_watermark=datetime(2026, 6, 1, 10, 6, tzinfo=UTC),
            until=datetime(2026, 6, 1, 10, 0, tzinfo=UTC),
            lookback=timedelta(minutes=5),
        )


def test_incremental_extraction_is_stably_ordered_and_bounded() -> None:
    dataset = generate_admissions_dataset(seed=2026, admission_count=17)
    candidates = tuple(row.model_dump() for row in dataset.admissions)
    source = InMemoryAdmissionsSource(reversed(candidates))
    window = ExtractionWindow(
        start_inclusive=min(row["updated_at"] for row in candidates),
        end_inclusive=max(row["updated_at"] for row in candidates),
    )

    extracted = tuple(extract_incrementally(source=source, window=window, batch_size=4))

    assert len(extracted) == 17
    assert extracted == tuple(
        sorted(extracted, key=lambda row: (row["updated_at"], row["source_admission_id"]))
    )
    assert source.requested_limits == [4, 4, 4, 4, 4]


def test_lookback_recovers_a_late_arriving_record() -> None:
    dataset = generate_admissions_dataset(seed=2026, admission_count=3)
    previous_watermark = datetime(2026, 8, 1, 10, 0, tzinfo=UTC)
    late_record = dataset.admissions[0].model_dump()
    late_record["submitted_at"] = previous_watermark - timedelta(days=1)
    late_record["updated_at"] = previous_watermark - timedelta(minutes=2)
    source = InMemoryAdmissionsSource([late_record])
    window = ExtractionWindow.from_watermark(
        previous_watermark=previous_watermark,
        until=previous_watermark + timedelta(minutes=5),
        lookback=timedelta(minutes=5),
    )

    assert tuple(extract_incrementally(source=source, window=window, batch_size=100)) == (late_record,)


class FakeCursor:
    def __init__(self, rows=()):
        self.query = ""
        self.params = ()
        self.rows = rows

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def execute(self, query, params):
        self.query = query
        self.params = params

    def fetchall(self):
        return self.rows


class FakeConnection:
    def __init__(self, rows=()):
        self.cursor_instance = FakeCursor(rows)

    def cursor(self, **_kwargs):
        return self.cursor_instance


def test_postgres_source_uses_explicit_columns_and_parameterized_keyset_pagination() -> None:
    connection = FakeConnection()
    source = PostgresAdmissionsSource(connection)
    window = ExtractionWindow(
        start_inclusive=datetime(2026, 6, 1, tzinfo=UTC),
        end_inclusive=datetime(2026, 6, 2, tzinfo=UTC),
    )
    after = (datetime(2026, 6, 1, 12, 0, tzinfo=UTC), 99)

    assert source.fetch_batch(window=window, after=after, limit=250) == ()

    normalized_query = " ".join(connection.cursor_instance.query.split()).lower()
    assert "select *" not in normalized_query
    assert "submitted_at at time zone 'utc' as submitted_at" in normalized_query
    assert "updated_at >= (%s at time zone 'utc')" in normalized_query
    assert "order by updated_at asc, id asc" in normalized_query
    assert "(updated_at, id) > ((%s at time zone 'utc'), %s)" in normalized_query
    assert connection.cursor_instance.params == (
        window.start_inclusive,
        window.end_inclusive,
        after[0],
        after[1],
        250,
    )


def test_postgres_source_projects_but_does_not_hide_invalid_business_values() -> None:
    valid = generate_admissions_dataset(seed=2026, admission_count=1).admissions[0]
    source_row = {"id": valid.source_admission_id, **valid.model_dump(exclude={"source_admission_id"})}
    source_row.update({"status": "Approved", "email": "must-not-cross@example.test"})
    connection = FakeConnection([source_row])

    candidate = PostgresAdmissionsSource(connection).fetch_batch(
        window=ExtractionWindow(
            start_inclusive=valid.updated_at - timedelta(minutes=1),
            end_inclusive=valid.updated_at + timedelta(minutes=1),
        ),
        after=None,
        limit=10,
    )[0]

    assert candidate["status"] == "Approved"
    assert candidate["source_admission_id"] == valid.source_admission_id
    assert "email" not in candidate
