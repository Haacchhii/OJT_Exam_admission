"""Deterministic synthetic data for local development and portfolio demos."""

from datetime import UTC, datetime, timedelta
from random import Random

from pydantic import Field

from data_platform.contracts import (
    AcademicYearRecord,
    AdmissionRecord,
    ContractModel,
    SemesterRecord,
)


class SyntheticAdmissionsDataset(ContractModel):
    academic_years: tuple[AcademicYearRecord, ...]
    semesters: tuple[SemesterRecord, ...]
    admissions: tuple[AdmissionRecord, ...] = Field(default_factory=tuple)


def generate_admissions_dataset(*, seed: int, admission_count: int) -> SyntheticAdmissionsDataset:
    if admission_count < 0:
        raise ValueError("admission_count must be non-negative")

    random = Random(seed)
    created_at = datetime(2025, 1, 1, tzinfo=UTC)
    academic_years = (
        AcademicYearRecord(
            source_academic_year_id=1,
            year="2025-2026",
            is_active=False,
            start_date=datetime(2025, 6, 1, tzinfo=UTC),
            end_date=datetime(2026, 3, 31, tzinfo=UTC),
            created_at=created_at,
        ),
        AcademicYearRecord(
            source_academic_year_id=2,
            year="2026-2027",
            is_active=True,
            start_date=datetime(2026, 6, 1, tzinfo=UTC),
            end_date=datetime(2027, 3, 31, tzinfo=UTC),
            created_at=created_at,
        ),
    )
    semesters = tuple(
        SemesterRecord(
            source_semester_id=academic_year.source_academic_year_id * 10 + number,
            name=name,
            academic_year_id=academic_year.source_academic_year_id,
            is_active=academic_year.is_active and number == 1,
            start_date=datetime(int(academic_year.year[:4]), month, 1, tzinfo=UTC),
            end_date=datetime(int(academic_year.year[:4]) + end_year_offset, end_month, end_day, tzinfo=UTC),
            created_at=created_at,
        )
        for academic_year in academic_years
        for number, name, month, end_year_offset, end_month, end_day in (
            (1, "First Semester", 6, 0, 10, 31),
            (2, "Second Semester", 11, 1, 3, 31),
        )
    )

    grade_levels = ("Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12")
    statuses = ("Submitted", "Under Screening", "Under Evaluation", "Accepted", "Rejected")
    applicant_types = ("New", "Transferee", "Returning", "Continuing")
    admissions: list[AdmissionRecord] = []
    for index in range(admission_count):
        semester = random.choice(semesters)
        grade_level = random.choice(grade_levels)
        submitted_at = semester.start_date + timedelta(days=random.randint(0, 60), minutes=index)
        admissions.append(
            AdmissionRecord(
                source_admission_id=index + 1,
                grade_level=grade_level,
                level_group=(
                    "Senior High School"
                    if grade_level in {"Grade 11", "Grade 12"}
                    else "Junior High School"
                ),
                school_year=academic_years[semester.academic_year_id - 1].year,
                applicant_type=random.choice(applicant_types),
                status=random.choice(statuses),
                academic_year_id=semester.academic_year_id,
                semester_id=semester.source_semester_id,
                submitted_at=submitted_at,
                updated_at=submitted_at + timedelta(hours=random.randint(0, 120)),
                deleted_at=None,
            )
        )

    return SyntheticAdmissionsDataset(
        academic_years=academic_years,
        semesters=semesters,
        admissions=tuple(admissions),
    )
