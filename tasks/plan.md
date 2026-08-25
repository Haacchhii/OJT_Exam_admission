# Implementation Plan: GoldenKey Admissions Data Platform

## Overview

Build the platform in small vertical slices while preserving the current GoldenKey
application. Establish a reproducible local foundation first, then deliver one
complete admissions path from source extraction through a curated mart. Add
orchestration and visualization only after the pipeline is independently testable.

## Architecture Decisions

- Keep the platform in `data-platform/` within the existing repository.
- Treat Supabase PostgreSQL as the production operational source.
- Use a separate local PostgreSQL source for development and CI safety.
- Use standard PostgreSQL and S3-compatible interfaces to avoid vendor lock-in.
- Use batch ELT first; defer event streaming until a measured use case exists.
- Keep immutable raw Parquet separate from the analytical PostgreSQL warehouse.
- Keep Airflow DAGs thin; tested Python modules contain pipeline behavior.
- Model current-state admissions first; do not infer unavailable status history.

## Dependency Graph

```text
Configuration and local services
  -> Source contract and synthetic fixtures
    -> Incremental admissions extraction
      -> Raw Parquet storage and manifest
        -> Validation, quarantine, and reconciliation
          -> Warehouse loading
            -> dbt staging and admissions mart
              -> Airflow orchestration
                -> Metabase dashboard and portfolio evidence
```

## Phases

### Phase 1: Baseline and foundation

- Document and run existing backend, frontend, and performance checks.
- Add local data-platform services and validated placeholder configuration.
- Add the Python package skeleton and first configuration tests.

### Checkpoint: Foundation

- Existing application baseline is documented.
- Docker Compose configuration validates.
- Configuration tests pass without real credentials.

### Phase 2: Admissions ingestion slice

- Define source contracts for admissions, academic years, and semesters.
- Add deterministic synthetic source records.
- Extract incrementally using an overlap window and stable ordering.
- Write partitioned Parquet and a manifest containing run metadata.
- Validate records, quarantine failures, and reconcile row counts.

### Checkpoint: Raw admissions pipeline

- First run extracts expected rows.
- Identical rerun is idempotent.
- Late-arriving and invalid records are covered by tests.

### Phase 3: Analytical warehouse

- Load accepted records into warehouse landing tables.
- Add dbt sources and staging models.
- Add admissions dimensions, facts, and current-state funnel mart.
- Add at least 15 meaningful data-quality assertions and dbt documentation.

### Checkpoint: Trusted admissions mart

- `dbt build` passes.
- Source-to-mart reconciliation is documented.
- No model exposes password hashes, tokens, document paths, or unnecessary PII.

### Phase 4: Operations and presentation

- Orchestrate the tested modules with a thin Airflow DAG.
- Record pipeline-run status, duration, watermarks, and row counts.
- Connect Metabase only to curated warehouse models.
- Add architecture, lineage, setup, and portfolio case-study documentation.

### Checkpoint: MVP complete

- A clean machine can run the documented local workflow.
- CI verifies pipeline and dbt tests.
- The dashboard renders from synthetic curated data.
- Existing application regression gates remain green.

### Phase 5: Evidence-led application improvements

- Triage correctness and performance findings discovered during the work.
- Reproduce and measure one issue at a time.
- Implement fixes in separate commits with regression tests and before/after evidence.
- Consider append-only admission status events through a separately approved schema change.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Production credentials leak | High | Local-first development, placeholder examples, secret scans, read-only production role |
| PII reaches raw demos | High | Synthetic fixtures, explicit allowlists, sensitive-column tests |
| Airflow overwhelms local hardware | Medium | Minimal services/profile, resource limits, pipeline runnable without Airflow |
| Timestamp updates are missed | High | UTC watermarks, overlap window, stable key ordering, idempotent merge tests |
| Current status is mistaken for history | High | Current-state mart naming and explicit documentation |
| Platform work destabilizes app | Medium | Separate modules and commits; existing test/build gates |
| Tooling obscures engineering logic | Medium | Thin adapters and DAGs; behavior lives in ordinary tested Python |

## Open Questions

- Production read-only Supabase credentials will be configured only when local
  ingestion is verified and the user is ready to connect the production source.
- The first status-event schema proposal will be reviewed separately after the
  current-state admissions MVP.
