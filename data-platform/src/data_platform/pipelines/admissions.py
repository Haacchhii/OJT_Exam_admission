"""Admissions extraction-to-raw pipeline composition."""

from datetime import datetime, timedelta

from data_platform.contracts import ContractModel
from data_platform.ingestion.admissions import (
    AdmissionsSource,
    ExtractionWindow,
    extract_incrementally,
)
from data_platform.quality.admissions import AdmissionsQualityGate, QualityReconciliation
from data_platform.quality.storage import QualityArtifactManifest, write_quality_artifacts
from data_platform.storage.raw import (
    ExtractionManifest,
    RawStorage,
    write_admissions_raw,
)


class AdmissionsPipelineResult(ContractModel):
    raw_manifest: ExtractionManifest
    reconciliation: QualityReconciliation
    quality_artifacts: QualityArtifactManifest


def run_admissions_extract(
    *,
    source: AdmissionsSource,
    storage: RawStorage,
    previous_watermark: datetime,
    until: datetime,
    lookback: timedelta,
    batch_size: int,
    part_size: int,
    run_id: str,
    extracted_at: datetime,
) -> AdmissionsPipelineResult:
    window = ExtractionWindow.from_watermark(
        previous_watermark=previous_watermark,
        until=until,
        lookback=lookback,
    )
    candidates = extract_incrementally(
        source=source,
        window=window,
        batch_size=batch_size,
    )
    quality_gate = AdmissionsQualityGate(run_id=run_id)
    raw_manifest = write_admissions_raw(
        records=quality_gate.accepted_records(candidates),
        storage=storage,
        window=window,
        run_id=run_id,
        extracted_at=extracted_at,
        part_size=part_size,
    )
    quality_result = quality_gate.result()
    quality_artifacts = write_quality_artifacts(
        result=quality_result,
        storage=storage,
        recorded_at=extracted_at,
    )
    return AdmissionsPipelineResult(
        raw_manifest=raw_manifest,
        reconciliation=quality_result.reconciliation,
        quality_artifacts=quality_artifacts,
    )
