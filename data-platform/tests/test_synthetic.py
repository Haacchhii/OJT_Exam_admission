from data_platform.synthetic import generate_admissions_dataset


def test_synthetic_dataset_is_deterministic_for_the_same_seed() -> None:
    assert generate_admissions_dataset(seed=2026, admission_count=25) == generate_admissions_dataset(
        seed=2026, admission_count=25
    )


def test_synthetic_dataset_changes_with_a_different_seed() -> None:
    assert generate_admissions_dataset(seed=2026, admission_count=25) != generate_admissions_dataset(
        seed=2027, admission_count=25
    )


def test_synthetic_dataset_preserves_reference_relationships() -> None:
    dataset = generate_admissions_dataset(seed=2026, admission_count=40)
    academic_year_ids = {row.source_academic_year_id for row in dataset.academic_years}
    semester_lookup = {row.source_semester_id: row for row in dataset.semesters}

    assert len(dataset.admissions) == 40
    assert all(row.academic_year_id in academic_year_ids for row in dataset.semesters)
    assert all(row.academic_year_id in academic_year_ids for row in dataset.admissions)
    assert all(row.semester_id in semester_lookup for row in dataset.admissions)
    assert all(
        semester_lookup[row.semester_id].academic_year_id == row.academic_year_id
        for row in dataset.admissions
    )
    assert all(
        row.level_group
        == ("Senior High School" if row.grade_level in {"Grade 11", "Grade 12"} else "Junior High School")
        for row in dataset.admissions
    )


def test_synthetic_dataset_contains_no_direct_identifiers() -> None:
    dataset = generate_admissions_dataset(seed=2026, admission_count=10)
    serialized = dataset.model_dump_json()

    for forbidden_field in ("first_name", "last_name", "email", "phone", "dob", "lrn", "guardian", "notes"):
        assert forbidden_field not in serialized
