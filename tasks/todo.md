# GoldenKey Data Platform Tasks

## Task 1: Capture the existing application baseline

**Acceptance criteria:**
- [ ] Backend tests, frontend lint/build, and available performance checks are run.
- [ ] Failures and environment-dependent skips are recorded without changing behavior.

**Verification:** Run the repository's existing documented commands.

**Dependencies:** None

**Files likely touched:** `docs/architecture/data-platform-baseline.md`

**Estimated scope:** Small

## Task 2: Add validated local platform configuration

**Acceptance criteria:**
- [ ] `data-platform/.env.example` contains placeholders only.
- [ ] Configuration fails clearly when required values are absent or unsafe.
- [ ] Unit tests cover valid, missing, and malformed configuration.

**Verification:** `python -m pytest data-platform/tests/test_config.py`

**Dependencies:** Task 1

**Files likely touched:** configuration module, example environment file, tests

**Estimated scope:** Medium

## Task 3: Add the minimal local service foundation

**Acceptance criteria:**
- [ ] Compose defines isolated source, warehouse, and MinIO services.
- [ ] Services include health checks and persistent named volumes.
- [ ] No credentials or host-specific paths are committed.

**Verification:** `docker compose -f data-platform/docker-compose.yml config`

**Dependencies:** Task 2

**Files likely touched:** Compose file and setup documentation

**Estimated scope:** Small

## Task 4: Define admissions source contracts and synthetic fixtures

**Acceptance criteria:**
- [ ] Contracts cover admissions, academic years, and semesters.
- [ ] Sensitive fields are explicitly excluded from analytical extraction.
- [ ] Synthetic fixtures are deterministic and preserve required relationships.

**Verification:** Focused contract and fixture tests pass.

**Dependencies:** Task 2

**Files likely touched:** contract models, synthetic generator, tests

**Estimated scope:** Medium

## Task 5: Implement incremental raw admissions extraction

**Acceptance criteria:**
- [ ] Extraction uses UTC watermarks, overlap, stable ordering, and bounded batches.
- [ ] Raw output is partitioned Parquet with run metadata and a manifest.
- [ ] Re-running the same interval produces identical logical records.

**Verification:** Unit and integration tests for first run, rerun, and late arrival pass.

**Dependencies:** Tasks 3 and 4

**Files likely touched:** extractor, raw storage adapter, manifest model, tests

**Estimated scope:** Medium

## Task 6: Add validation, quarantine, and reconciliation

**Acceptance criteria:**
- [ ] Invalid records retain a reason and pipeline run ID in quarantine.
- [ ] Extracted equals accepted plus rejected for every run.
- [ ] Invalid records cannot silently enter curated models.

**Verification:** Quality tests with deliberately invalid fixtures pass.

**Dependencies:** Task 5

**Files likely touched:** quality rules, reconciliation model, tests

**Estimated scope:** Medium

## Task 7: Load warehouse landing tables idempotently

**Acceptance criteria:**
- [ ] Accepted records load into separate analytical PostgreSQL tables.
- [ ] Natural/source keys and source update timestamps drive idempotent merges.
- [ ] Loads never write to operational source tables.

**Verification:** Integration test runs the same batch twice without duplicates.

**Dependencies:** Task 6

**Files likely touched:** warehouse loader, SQL bootstrap, tests

**Estimated scope:** Medium

## Task 8: Build the dbt admissions mart

**Acceptance criteria:**
- [ ] Sources, staging models, dimensions, facts, and current-state funnel mart build.
- [ ] At least 15 meaningful quality assertions pass.
- [ ] Models and sensitive-field exclusions are documented in dbt Docs.

**Verification:** `dbt build --project-dir data-platform/dbt --profiles-dir data-platform/dbt`

**Dependencies:** Task 7

**Files likely touched:** dbt project, models, tests, documentation

**Estimated scope:** Medium tasks split by layer during implementation

## Task 9: Orchestrate and observe the admissions pipeline

**Acceptance criteria:**
- [ ] A thin Airflow DAG runs extraction, validation, loading, and dbt in order.
- [ ] Pipeline status, duration, watermarks, and row counts are queryable.
- [ ] Failed retries remain idempotent.

**Verification:** Local DAG test and a successful synthetic end-to-end run.

**Dependencies:** Task 8

**Files likely touched:** DAG, audit store, tests

**Estimated scope:** Medium

## Task 10: Present the curated admissions data

**Acceptance criteria:**
- [ ] Metabase reads only curated warehouse models.
- [ ] One dashboard shows funnel, volume, processing, and quality metrics.
- [ ] Architecture, lineage, privacy, setup, and limitations are documented.

**Verification:** Reproduce the dashboard from a clean synthetic-data run.

**Dependencies:** Task 9

**Files likely touched:** Metabase configuration and portfolio documentation

**Estimated scope:** Medium

## Checkpoints

- [ ] After Tasks 1-3: application baseline and local foundation reviewed.
- [ ] After Tasks 4-6: raw admissions pipeline reviewed.
- [ ] After Tasks 7-8: trusted admissions mart reviewed.
- [ ] After Tasks 9-10: MVP reviewed before merge or deployment.
