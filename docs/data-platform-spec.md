# Spec: GoldenKey Admissions Data Platform

## Objective

Extend the existing GoldenKey admissions and examination application with a
free, locally reproducible data platform. The operational application remains
the system of record in Supabase PostgreSQL. The platform incrementally copies
approved source data into an immutable raw layer, validates it, transforms it
into analytics-ready warehouse models, and exposes trustworthy admissions
metrics without querying production application tables from dashboards.

The primary audience is data-engineering recruiters and maintainers who need to
see reproducible ingestion, idempotency, data quality, dimensional modeling,
orchestration, observability, privacy controls, and documented tradeoffs.

The first vertical slice covers admissions, academic years, and semesters.
Exam data follows after the admissions pipeline is verified.

## Tech Stack

- Operational source: Supabase PostgreSQL in production; PostgreSQL in local/CI
- Ingestion: Python 3.12, psycopg, Pydantic, PyArrow
- Raw storage: Parquet in S3-compatible SeaweedFS object storage
- Analytical warehouse: PostgreSQL
- Transformations and tests: dbt Core with `dbt-postgres`
- Orchestration: Apache Airflow
- Analytics consumer: Metabase
- Local infrastructure: Docker Compose
- Application: existing React, Express, Prisma, and PostgreSQL stack

Pipeline code must use standard PostgreSQL and S3-compatible interfaces. It
must not depend on Supabase-specific APIs.

## Commands

The initial infrastructure task will make these commands executable:

```powershell
# Start local data infrastructure
docker compose -f data-platform/docker-compose.yml up -d

# Stop local data infrastructure without deleting volumes
docker compose -f data-platform/docker-compose.yml down

# Install pipeline dependencies
python -m pip install -r data-platform/requirements.txt

# Run ingestion tests
python -m pytest data-platform/tests

# Run an admissions ingestion locally
python -m data_platform.ingestion.admissions

# Build and test warehouse models
dbt build --project-dir data-platform/dbt --profiles-dir data-platform/dbt

# Existing application verification
cd backend; npm test
cd ../frontend-ts; npm run lint; npm run build:ci
```

## Project Structure

```text
data-platform/
  docker-compose.yml       Local warehouse, SeaweedFS, Airflow, and Metabase
  .env.example             Placeholder-only local configuration
  requirements.txt         Pinned Python data-platform dependencies
  src/data_platform/
    config.py              Validated runtime configuration
    ingestion/             Incremental source extractors
    storage/               Parquet and object-storage adapters
    quality/               Source-boundary validation and quarantine
    observability/         Pipeline run and reconciliation records
  tests/                   Unit and integration tests
  dbt/                     Staging, intermediate, mart, tests, and docs
  airflow/dags/            Thin orchestration DAGs
  synthetic/               Deterministic non-personal demonstration data
  metabase/                Reproducible dashboard configuration if practical
docs/
  data-platform-spec.md    Approved requirements and boundaries
  architecture/            Diagrams and data-flow documentation
tasks/
  plan.md                  Implementation phases and decisions
  todo.md                  Verifiable task checklist
```

## Code Style

Python code uses explicit types, dependency injection at I/O boundaries, UTC
timestamps, and small functions. Database queries are parameterized. Pipeline
runs receive a stable identifier and log structured context.

```python
def extract_admissions(
    connection: Connection,
    watermark: datetime,
    batch_size: int,
) -> Iterable[AdmissionRecord]:
    """Yield records updated after the exclusive UTC watermark."""
```

SQL models use lowercase snake_case names, explicit column lists, documented
keys, and layered `source` -> `staging` -> `intermediate` -> `mart` models.

## Testing Strategy

- Unit tests cover configuration, watermark behavior, validation, partitioning,
  and deterministic synthetic data.
- Integration tests run against disposable local PostgreSQL and object storage.
- Contract tests verify source columns and accepted enumerations.
- dbt tests cover uniqueness, non-null keys, relationships, accepted values,
  reconciliation, and business rules.
- A repeat-run test proves ingestion is idempotent.
- A late-arriving-record test proves the lookback strategy does not lose data.
- Existing backend tests, frontend lint, and frontend build remain regression
  gates whenever application code changes.
- Performance fixes require a reproducible benchmark with before/after results.

## Boundaries

### Always

- Use synthetic data in public development, tests, screenshots, and demos.
- Keep production source access read-only for pipeline credentials.
- Store raw records immutably with extraction metadata and a pipeline run ID.
- Use UTC internally and convert to `Asia/Manila` only at presentation edges.
- Validate source data and quarantine invalid records with a reason.
- Reconcile extracted, accepted, rejected, and loaded row counts.
- Run relevant tests and scan staged changes for secrets before every commit.
- Keep data-platform changes and operational-application fixes in separate commits.

### Ask First

- Modify the Prisma schema or production database structure.
- Add a runtime dependency outside the approved stack.
- Change existing authentication, authorization, or admissions behavior.
- Change or delete production data, Supabase configuration, or GitHub secrets.
- Merge the working branch into `main` or deploy changes.

### Never

- Commit credentials, real applicant data, uploaded documents, or database dumps.
- Give Metabase, CI, or ingestion jobs write access to production source tables.
- Query the production application database directly from public dashboards.
- Rewrite shared Git history or push directly to `main`.
- claim historical status-transition metrics from the current-state `status` field.
- Add Spark, Kafka/Redpanda, Kubernetes, or paid infrastructure to the MVP.

## Success Criteria

- A new contributor can start the platform locally using documented commands.
- Admissions, academic years, and semesters ingest incrementally from PostgreSQL.
- The raw layer stores partitioned Parquet plus extraction metadata.
- Re-running the same interval produces no duplicate warehouse records.
- Invalid records are quarantined and visible in pipeline reconciliation results.
- dbt builds documented staging and admissions mart models successfully.
- At least 15 meaningful automated data-quality assertions pass.
- Airflow executes ingestion, validation, loading, and dbt tasks in dependency order.
- Metabase reads only curated warehouse models and presents one admissions dashboard.
- CI validates Python tests, dbt models, and configuration without real credentials.
- Architecture, lineage, privacy decisions, and benchmark evidence are documented.
- Existing application regression gates remain green.

## Operational Application Improvements

Correctness and performance work may be discovered while building the platform.
Each issue must have a reproduction, failing test, query plan, or benchmark before
the implementation changes. Fixes use separate `fix:` or `performance:` commits
and must not be hidden inside data-pipeline commits.

The existing admissions status field contains current state only. Historical
status-duration analysis requires a future append-only status-event model and is
not part of the first ingestion slice.

## Open Questions

None blocking the first slice. Supabase production connectivity will be configured
later using user-managed, read-only credentials; local and CI work must not require it.
