"""Validated, privacy-safe records allowed to cross into analytics."""

from datetime import datetime
from typing import Any, Literal, Mapping

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator


AdmissionStatus = Literal[
    "Submitted",
    "Under Screening",
    "Under Evaluation",
    "Accepted",
    "Rejected",
]
ApplicantType = Literal["New", "Transferee", "Returning", "Continuing"]

ADMISSION_SOURCE_FIELDS = {
    "id",
    "grade_level",
    "level_group",
    "school_year",
    "applicant_type",
    "status",
    "academic_year_id",
    "semester_id",
    "submitted_at",
    "updated_at",
    "deleted_at",
}

SENSITIVE_ADMISSION_FIELDS = {
    "tracking_id",
    "user_id",
    "first_name",
    "middle_name",
    "last_name",
    "email",
    "phone",
    "dob",
    "gender",
    "address",
    "prev_school",
    "lrn",
    "student_number",
    "guardian",
    "guardian_relation",
    "guardian_phone",
    "guardian_email",
    "notes",
}

ACADEMIC_YEAR_SOURCE_FIELDS = {
    "id",
    "year",
    "is_active",
    "start_date",
    "end_date",
    "created_at",
}

SEMESTER_SOURCE_FIELDS = {
    "id",
    "name",
    "academic_year_id",
    "is_active",
    "start_date",
    "end_date",
    "created_at",
}


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class AdmissionRecord(ContractModel):
    source_admission_id: int = Field(gt=0)
    grade_level: str = Field(min_length=1, max_length=50)
    level_group: str | None = Field(default=None, max_length=100)
    school_year: str = Field(pattern=r"^\d{4}-\d{4}$")
    applicant_type: ApplicantType
    status: AdmissionStatus
    academic_year_id: int | None = Field(default=None, gt=0)
    semester_id: int | None = Field(default=None, gt=0)
    submitted_at: AwareDatetime
    updated_at: AwareDatetime
    deleted_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def validate_timeline(self) -> "AdmissionRecord":
        if self.updated_at < self.submitted_at:
            raise ValueError("updated_at must not precede submitted_at")
        if self.deleted_at is not None and self.deleted_at < self.submitted_at:
            raise ValueError("deleted_at must not precede submitted_at")
        if (self.academic_year_id is None) != (self.semester_id is None):
            raise ValueError("academic_year_id and semester_id must both be set or both be null")
        return self


class AcademicYearRecord(ContractModel):
    source_academic_year_id: int = Field(gt=0)
    year: str = Field(pattern=r"^\d{4}-\d{4}$")
    is_active: bool
    start_date: AwareDatetime | None = None
    end_date: AwareDatetime | None = None
    created_at: AwareDatetime

    @model_validator(mode="after")
    def validate_dates(self) -> "AcademicYearRecord":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must not precede start_date")
        return self


class SemesterRecord(ContractModel):
    source_semester_id: int = Field(gt=0)
    name: Literal["First Semester", "Second Semester", "Summer"]
    academic_year_id: int = Field(gt=0)
    is_active: bool
    start_date: AwareDatetime | None = None
    end_date: AwareDatetime | None = None
    created_at: AwareDatetime

    @model_validator(mode="after")
    def validate_dates(self) -> "SemesterRecord":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must not precede start_date")
        return self


def extract_admission_record(source_row: Mapping[str, Any]) -> AdmissionRecord:
    """Project an untrusted source row through the analytical allowlist."""
    allowed = {field: source_row[field] for field in ADMISSION_SOURCE_FIELDS if field in source_row}
    allowed["source_admission_id"] = allowed.pop("id", None)
    return AdmissionRecord.model_validate(allowed)


def extract_academic_year_record(source_row: Mapping[str, Any]) -> AcademicYearRecord:
    allowed = {field: source_row[field] for field in ACADEMIC_YEAR_SOURCE_FIELDS if field in source_row}
    allowed["source_academic_year_id"] = allowed.pop("id", None)
    return AcademicYearRecord.model_validate(allowed)


def extract_semester_record(source_row: Mapping[str, Any]) -> SemesterRecord:
    allowed = {field: source_row[field] for field in SEMESTER_SOURCE_FIELDS if field in source_row}
    allowed["source_semester_id"] = allowed.pop("id", None)
    return SemesterRecord.model_validate(allowed)
