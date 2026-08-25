# Incremental admissions extraction

## Data flow

```text
PostgreSQL admissions
  -> privacy-safe explicit SELECT
  -> Pydantic admission contract
  -> bounded keyset pages
  -> content-addressed Parquet parts
  -> immutable run manifest
  -> filesystem (tests) or SeaweedFS (local platform)
```

The operational database remains read-only. The extractor selects only the
allowlisted fields documented in `admissions-source-contracts.md`; it never uses
`SELECT *`.

## Watermark behavior

Each run receives a previous successful UTC watermark and a fixed inclusive end
time. Its lower bound is:

```text
previous_watermark - configured_lookback
```

The overlap intentionally re-reads recent records so updates committed late are
not lost. Downstream idempotent warehouse merges will use `source_admission_id`
and `updated_at` to collapse overlap. Watermarks advance only after later
pipeline stages succeed; Task 9 will persist that orchestration state.

Rows are ordered and paged by `(updated_at, id)`. Every query is bounded by the
configured batch size and uses separately bound Psycopg parameters. The current
Prisma schema stores `DateTime` as PostgreSQL `TIMESTAMP(3)` without timezone,
so SQL explicitly interprets source timestamps as UTC instead of relying on the
connection's session timezone.

## Raw layout and idempotency

Parquet parts use an explicit schema and Zstandard compression:

```text
admissions/
  extracted_date=YYYY-MM-DD/
    window_end=YYYYMMDDTHHMMSSZ/
      part-NNNNN-<content-hash>.parquet
  manifests/
    extracted_date=YYYY-MM-DD/
      <run-id>.json
```

Data-object names include a SHA-256-derived suffix. Re-running the same interval
with the same records and part size therefore reuses the same logical Parquet
objects, while each run retains its own manifest, timestamp, counts, window, and
full object hashes. Existing objects may be reused only when their bytes match;
a conflicting overwrite fails.

The filesystem adapter makes tests and offline demonstrations reproducible. The
S3 adapter uses PyArrow's native `S3FileSystem` with an endpoint override, so it
connects to SeaweedFS without a vendor-specific API or an extra S3 dependency.

## Verification and limitations

Automated tests cover first extraction, bounded ordering, reruns, late arrivals,
Parquet round trips, sensitive-field exclusion, manifests, unsafe object keys,
and both storage adapters. Live PostgreSQL and SeaweedFS verification remains
pending because Docker is unavailable in the current development environment.

The source schema does not currently declare an index beginning with
`updated_at`. No schema change was made because production schema changes require
approval and performance work requires a real query plan. Once a representative
local database is available, capture `EXPLAIN (ANALYZE, BUFFERS)` before deciding
whether to add an `(updated_at, id)` index in a separate performance commit.

## Official references

- https://www.psycopg.org/psycopg3/docs/basic/params.html
- https://www.psycopg.org/psycopg3/docs/advanced/cursors.html
- https://arrow.apache.org/docs/python/parquet.html
- https://arrow.apache.org/docs/python/generated/pyarrow.parquet.write_table.html
- https://arrow.apache.org/docs/python/filesystems.html
- https://arrow.apache.org/docs/python/generated/pyarrow.fs.S3FileSystem.html
