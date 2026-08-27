"""Durable quarantine and reconciliation artifacts."""

from datetime import datetime, timedelta
from hashlib import sha256
import json
from typing import Self

from pydantic import Field, model_validator

from data_platform.contracts import ContractModel
from data_platform.quality.admissions import (
    QualityGateResult,
    QualityValidationResult,
    RUN_ID_PATTERN,
)
from data_platform.storage.raw import RawStorage


class QualityArtifactManifest(ContractModel):
    pipeline_run_id: str = Field(pattern=RUN_ID_PATTERN)
    quarantine_key: str | None = None
    quarantine_sha256: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    reconciliation_key: str = Field(min_length=1)
    reconciliation_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")

    @model_validator(mode="after")
    def require_complete_quarantine_reference(self) -> Self:
        if (self.quarantine_key is None) != (self.quarantine_sha256 is None):
            raise ValueError("quarantine key and hash must both be set or both be null")
        return self


def _utc_date(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() != timedelta(0):
        raise ValueError("quality artifact timestamp must be timezone-aware UTC")
    return value.date().isoformat()


def _canonical_json(value: object) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def write_quality_artifacts(
    *,
    result: QualityValidationResult | QualityGateResult,
    storage: RawStorage,
    recorded_at: datetime,
) -> QualityArtifactManifest:
    partition_date = _utc_date(recorded_at)
    run_id = result.reconciliation.pipeline_run_id
    quarantine_key: str | None = None
    quarantine_hash: str | None = None

    if result.rejected:
        quarantine_content = b"\n".join(
            _canonical_json(row.model_dump(mode="json")) for row in result.rejected
        ) + b"\n"
        quarantine_hash = sha256(quarantine_content).hexdigest()
        quarantine_key = (
            f"admissions/quarantine/extracted_date={partition_date}"
            f"/run_id={run_id}/rejected-{quarantine_hash[:16]}.jsonl"
        )
        storage.put_if_absent(quarantine_key, quarantine_content)

    reconciliation_content = _canonical_json(
        result.reconciliation.model_dump(mode="json")
    )
    reconciliation_hash = sha256(reconciliation_content).hexdigest()
    reconciliation_key = (
        f"admissions/reconciliation/extracted_date={partition_date}/{run_id}.json"
    )
    storage.put_if_absent(reconciliation_key, reconciliation_content)

    return QualityArtifactManifest(
        pipeline_run_id=run_id,
        quarantine_key=quarantine_key,
        quarantine_sha256=quarantine_hash,
        reconciliation_key=reconciliation_key,
        reconciliation_sha256=reconciliation_hash,
    )
