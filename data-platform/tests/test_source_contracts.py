from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from data_platform.contracts import (
    AdmissionRecord,
    AcademicYearRecord,
    SemesterRecord,
    extract_academic_year_record,
    extract_admission_record,
    extract_semester_record,
)


def _source_admission() -> dict[str, object]:
    return {
        "id": 101,
        "tracking_id": "GK-ADM-2026-00101",
        "user_id": 55,
        "first_name": "Synthetic",
        "middle_name": None,
        "last_name": "Applicant",
        "email": "synthetic@example.test",
        "phone": "0000000000",
        "dob": "2010-01-01",
        "gender": "Female",
        "address": "Synthetic address",
        "grade_level": "Grade 11",
        "level_group": "Senior High School",
        "prev_school": "Synthetic School",
        "school_year": "2026-2027",
        "lrn": "100000000001",
        "applicant_type": "New",
        "student_number": None,
        "guardian": "Synthetic Guardian",
        "guardian_relation": "Parent",
        "guardian_phone": "0000000000",
        "guardian_email": "guardian@example.test",
        "status": "Submitted",
        "notes": "Private free text",
        "academic_year_id": 1,
        "semester_id": 11,
        "submitted_at": datetime(2026, 6, 1, tzinfo=UTC),
        "updated_at": datetime(2026, 6, 2, tzinfo=UTC),
        "deleted_at": None,
    }


def test_admission_extraction_uses_a_privacy_safe_allowlist() -> None:
    record = extract_admission_record(_source_admission())

    assert record == AdmissionRecord(
        source_admission_id=101,
        grade_level="Grade 11",
        level_group="Senior High School",
        school_year="2026-2027",
        applicant_type="New",
        status="Submitted",
        academic_year_id=1,
        semester_id=11,
        submitted_at=datetime(2026, 6, 1, tzinfo=UTC),
        updated_at=datetime(2026, 6, 2, tzinfo=UTC),
        deleted_at=None,
    )
    assert not ({"tracking_id", "first_name", "email", "dob", "lrn", "notes"} & record.model_fields_set)


def test_admission_contract_rejects_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        AdmissionRecord.model_validate(
            {
                **extract_admission_record(_source_admission()).model_dump(),
                "email": "must-not-cross-boundary@example.test",
            }
        )


def test_admission_contract_rejects_invalid_status_and_naive_timestamps() -> None:
    source = _source_admission()
    source["status"] = "Approved"
    source["updated_at"] = datetime(2026, 6, 2)

    with pytest.raises(ValidationError):
        extract_admission_record(source)


def test_reference_contracts_cover_academic_years_and_semesters() -> None:
    academic_year = extract_academic_year_record(
        {
            "id": 1,
            "year": "2026-2027",
            "is_active": True,
            "start_date": datetime(2026, 6, 1, tzinfo=UTC),
            "end_date": datetime(2027, 3, 31, tzinfo=UTC),
            "created_at": datetime(2026, 1, 1, tzinfo=UTC),
            "unexpected": "excluded",
        }
    )
    semester = extract_semester_record(
        {
            "id": 11,
            "name": "First Semester",
            "academic_year_id": academic_year.source_academic_year_id,
            "is_active": True,
            "start_date": datetime(2026, 6, 1, tzinfo=UTC),
            "end_date": datetime(2026, 10, 31, tzinfo=UTC),
            "created_at": datetime(2026, 1, 1, tzinfo=UTC),
            "unexpected": "excluded",
        }
    )

    assert isinstance(academic_year, AcademicYearRecord)
    assert isinstance(semester, SemesterRecord)
    assert semester.academic_year_id == academic_year.source_academic_year_id
