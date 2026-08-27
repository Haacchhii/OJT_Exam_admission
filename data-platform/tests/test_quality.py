import json

import pytest
from pydantic import ValidationError

from data_platform.quality.admissions import (
    AdmissionsQualityGate,
    AcceptedAdmission,
    QualityReconciliation,
    QuarantinedAdmission,
    classify_admission,
    validate_admissions,
)
from data_platform.synthetic import generate_admissions_dataset


def test_valid_candidate_is_accepted() -> None:
    candidate = generate_admissions_dataset(seed=2026, admission_count=1).admissions[0].model_dump()

    outcome = classify_admission(candidate, run_id="run-quality-001")

    assert isinstance(outcome, AcceptedAdmission)
    assert outcome.record.source_admission_id == candidate["source_admission_id"]


def test_invalid_candidate_retains_safe_payload_reason_and_run_id() -> None:
    candidate = generate_admissions_dataset(seed=2026, admission_count=1).admissions[0].model_dump()
    candidate.update(
        {
            "status": "Approved",
            "applicant_type": "Guest",
            "email": "must-not-enter-quarantine@example.test",
        }
    )

    outcome = classify_admission(candidate, run_id="run-quality-002")

    assert isinstance(outcome, QuarantinedAdmission)
    assert outcome.pipeline_run_id == "run-quality-002"
    assert outcome.source_admission_id == candidate["source_admission_id"]
    assert {(issue.field, issue.code) for issue in outcome.issues} == {
        ("applicant_type", "literal_error"),
        ("status", "literal_error"),
    }
    payload = json.loads(outcome.candidate_json)
    assert payload["status"] == "Approved"
    assert "email" not in payload


def test_validation_reconciles_extracted_accepted_and_rejected_counts() -> None:
    candidates = [
        row.model_dump()
        for row in generate_admissions_dataset(seed=2026, admission_count=4).admissions
    ]
    candidates[1]["status"] = "Invalid"
    candidates[3]["school_year"] = "2026"

    result = validate_admissions(candidates, run_id="run-quality-003")

    assert len(result.accepted) == 2
    assert len(result.rejected) == 2
    assert result.reconciliation == QualityReconciliation(
        pipeline_run_id="run-quality-003",
        extracted_count=4,
        accepted_count=2,
        rejected_count=2,
    )


def test_reconciliation_rejects_inconsistent_counts() -> None:
    with pytest.raises(ValidationError, match="accepted_count plus rejected_count"):
        QualityReconciliation(
            pipeline_run_id="run-quality-004",
            extracted_count=10,
            accepted_count=8,
            rejected_count=1,
        )


def test_quality_gate_streams_accepted_records_and_finishes_once_consumed() -> None:
    candidates = [
        row.model_dump()
        for row in generate_admissions_dataset(seed=2026, admission_count=3).admissions
    ]
    candidates[1]["status"] = "Invalid"
    consumed = 0

    def candidate_stream():
        nonlocal consumed
        for candidate in candidates:
            consumed += 1
            yield candidate

    gate = AdmissionsQualityGate(run_id="run-quality-stream")
    accepted = gate.accepted_records(candidate_stream())

    assert consumed == 0
    first = next(accepted)
    assert first.source_admission_id == candidates[0]["source_admission_id"]
    assert consumed == 1
    with pytest.raises(RuntimeError, match="not fully consumed"):
        gate.result()

    assert len(tuple(accepted)) == 1
    result = gate.result()
    assert result.reconciliation.extracted_count == 3
    assert result.reconciliation.accepted_count == 2
    assert result.reconciliation.rejected_count == 1


def test_quality_gate_cannot_reconcile_a_partially_consumed_stream() -> None:
    candidate = generate_admissions_dataset(seed=2026, admission_count=1).admissions[0]
    gate = AdmissionsQualityGate(run_id="run-quality-partial")
    accepted = gate.accepted_records([candidate.model_dump()])

    next(accepted)
    accepted.close()

    with pytest.raises(RuntimeError, match="not fully consumed"):
        gate.result()
