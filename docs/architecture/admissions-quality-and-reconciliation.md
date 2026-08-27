# Admissions quality, quarantine, and reconciliation

## Purpose

The quality gate sits between incremental extraction and accepted raw Parquet.
It makes rejected data visible without allowing invalid records to silently
reach warehouse landing tables or curated models.

```text
privacy-safe source candidate
  -> contract validation
     -> accepted -> admissions Parquet
     -> rejected -> quarantine JSON Lines
  -> reconciliation JSON
```

Extraction performs privacy projection first but deliberately does not validate
business fields such as `status`, `applicant_type`, or `school_year`. This lets
the quality gate retain an accountable rejection instead of aborting the run at
the first invalid business value.

The two fields required for safe keyset pagination—`source_admission_id` and
`updated_at`—remain fatal extraction invariants. If either is malformed, the
extractor cannot establish progress safely and stops rather than skipping data.

## Validation outcomes

Accepted candidates become the strict `AdmissionRecord` contract and are the
only records written to accepted Parquet. Rejected candidates retain:

- The pipeline run ID.
- The source admission ID when available.
- Stable validation issue fields and codes.
- A canonical JSON representation of only the analytical allowlist.

Validation messages are intentionally reduced to field/code pairs. Raw Pydantic
messages can contain submitted values, which would make logs and quarantine
reason fields harder to control. The safe candidate JSON remains available for
diagnosis without containing names, contact details, LRN, guardian details, or
free-text notes.

## Artifact layout

```text
admissions/
  quarantine/
    extracted_date=YYYY-MM-DD/
      run_id=<run-id>/
        rejected-<content-hash>.jsonl
  reconciliation/
    extracted_date=YYYY-MM-DD/
      <run-id>.json
```

Quarantine is omitted when a run has no rejected records. Reconciliation is
always written and enforces this invariant during model validation:

```text
extracted_count = accepted_count + rejected_count
```

Both artifact types are immutable through the raw-storage interface. Their
SHA-256 hashes are returned in the pipeline result for later audit persistence
and orchestration.

## Operational questions

The artifacts answer the first operational questions without requiring access
to applicant data:

- How many rows did the run extract?
- How many were accepted or rejected?
- Which fields and validation rules caused each rejection?
- Which exact pipeline run produced the quarantine record?

Task 9 will persist these counts in the queryable pipeline audit store and emit
structured run-completion events. Task 6 does not introduce a logging framework
or duplicate the same counts into unstructured logs.

## Verification

Automated tests deliberately inject invalid status, applicant type, school-year,
and grade-level values. They prove reconciliation, run correlation, privacy-safe
quarantine payloads, and exclusion of rejected source IDs from accepted Parquet.
Live object-storage verification remains part of the Docker-enabled checkpoint.
