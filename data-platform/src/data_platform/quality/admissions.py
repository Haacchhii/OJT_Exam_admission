"""Admissions validation, quarantine reasons, and reconciliation."""

from collections.abc import Iterable, Iterator, Mapping
from datetime import datetime
import json
from typing import Any, Self

from pydantic import Field, ValidationError, model_validator

from data_platform.contracts import (
    AdmissionRecord,
    ContractModel,
    extract_admission_record,
    project_admission_candidate,
)


RUN_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$"


class QualityIssue(ContractModel):
    field: str = Field(min_length=1)
    code: str = Field(min_length=1)


class AcceptedAdmission(ContractModel):
    pipeline_run_id: str = Field(pattern=RUN_ID_PATTERN)
    record: AdmissionRecord


class QuarantinedAdmission(ContractModel):
    pipeline_run_id: str = Field(pattern=RUN_ID_PATTERN)
    source_admission_id: int | None = Field(default=None, gt=0)
    issues: tuple[QualityIssue, ...] = Field(min_length=1)
    candidate_json: str = Field(min_length=2)


class QualityReconciliation(ContractModel):
    pipeline_run_id: str = Field(pattern=RUN_ID_PATTERN)
    extracted_count: int = Field(ge=0)
    accepted_count: int = Field(ge=0)
    rejected_count: int = Field(ge=0)

    @model_validator(mode="after")
    def reconcile_counts(self) -> Self:
        if self.extracted_count != self.accepted_count + self.rejected_count:
            raise ValueError(
                "extracted_count must equal accepted_count plus rejected_count"
            )
        return self


class QualityValidationResult(ContractModel):
    accepted: tuple[AdmissionRecord, ...]
    rejected: tuple[QuarantinedAdmission, ...]
    reconciliation: QualityReconciliation


class QualityGateResult(ContractModel):
    rejected: tuple[QuarantinedAdmission, ...]
    reconciliation: QualityReconciliation


def _json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return f"<unsupported:{type(value).__name__}>"


def _candidate_json(candidate: Mapping[str, Any]) -> str:
    safe_candidate = project_admission_candidate(candidate)
    return json.dumps(
        safe_candidate,
        default=_json_default,
        sort_keys=True,
        separators=(",", ":"),
    )


def classify_admission(
    candidate: Mapping[str, Any],
    *,
    run_id: str,
) -> AcceptedAdmission | QuarantinedAdmission:
    safe_candidate = project_admission_candidate(candidate)
    try:
        record = extract_admission_record(safe_candidate)
    except ValidationError as error:
        issues = tuple(
            sorted(
                {
                    QualityIssue(
                        field=".".join(str(part) for part in detail["loc"])
                        or "__record__",
                        code=detail["type"],
                    )
                    for detail in error.errors(include_url=False, include_context=False)
                },
                key=lambda issue: (issue.field, issue.code),
            )
        )
        source_id = safe_candidate.get("source_admission_id")
        return QuarantinedAdmission(
            pipeline_run_id=run_id,
            source_admission_id=(
                source_id
                if isinstance(source_id, int) and not isinstance(source_id, bool)
                else None
            ),
            issues=issues,
            candidate_json=_candidate_json(safe_candidate),
        )
    return AcceptedAdmission(pipeline_run_id=run_id, record=record)


class AdmissionsQualityGate:
    """Single-pass gate that streams accepted records and tracks rejections."""

    def __init__(self, *, run_id: str) -> None:
        self._run_id = run_id
        self._extracted_count = 0
        self._accepted_count = 0
        self._rejected: list[QuarantinedAdmission] = []
        self._started = False
        self._finished = False

    def accepted_records(
        self,
        candidates: Iterable[Mapping[str, Any]],
    ) -> Iterator[AdmissionRecord]:
        if self._started:
            raise RuntimeError("quality gate can only consume one candidate stream")
        self._started = True
        for candidate in candidates:
            self._extracted_count += 1
            outcome = classify_admission(candidate, run_id=self._run_id)
            if isinstance(outcome, AcceptedAdmission):
                self._accepted_count += 1
                yield outcome.record
            else:
                self._rejected.append(outcome)
        self._finished = True

    def result(self) -> QualityGateResult:
        if not self._finished:
            raise RuntimeError("quality gate candidate stream was not fully consumed")
        reconciliation = QualityReconciliation(
            pipeline_run_id=self._run_id,
            extracted_count=self._extracted_count,
            accepted_count=self._accepted_count,
            rejected_count=len(self._rejected),
        )
        return QualityGateResult(
            rejected=tuple(self._rejected),
            reconciliation=reconciliation,
        )


def validate_admissions(
    candidates: Iterable[Mapping[str, Any]],
    *,
    run_id: str,
) -> QualityValidationResult:
    accepted: list[AdmissionRecord] = []
    rejected: list[QuarantinedAdmission] = []
    extracted_count = 0
    for candidate in candidates:
        extracted_count += 1
        outcome = classify_admission(candidate, run_id=run_id)
        if isinstance(outcome, AcceptedAdmission):
            accepted.append(outcome.record)
        else:
            rejected.append(outcome)

    reconciliation = QualityReconciliation(
        pipeline_run_id=run_id,
        extracted_count=extracted_count,
        accepted_count=len(accepted),
        rejected_count=len(rejected),
    )
    return QualityValidationResult(
        accepted=tuple(accepted),
        rejected=tuple(rejected),
        reconciliation=reconciliation,
    )
