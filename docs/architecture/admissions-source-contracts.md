# Admissions analytical source contracts

## Purpose

These contracts define the only operational fields allowed to cross from the
GoldenKey PostgreSQL application into the analytical platform. Source rows are
treated as untrusted and projected through an explicit allowlist before Pydantic
validation. A newly added operational column therefore stays excluded by
default.

## Allowed fields

| Source | Analytical fields | Purpose |
| --- | --- | --- |
| `admissions` | `id` (renamed `source_admission_id`), `grade_level`, `level_group`, `school_year`, `applicant_type`, `status`, `academic_year_id`, `semester_id`, `submitted_at`, `updated_at`, `deleted_at` | Pipeline identity, segmentation, lifecycle state, relationships, and incremental processing |
| `academic_years` | `id` (renamed `source_academic_year_id`), `year`, `is_active`, `start_date`, `end_date`, `created_at` | Academic calendar reference |
| `semesters` | `id` (renamed `source_semester_id`), `name`, `academic_year_id`, `is_active`, `start_date`, `end_date`, `created_at` | Academic period reference |

The integer source IDs are internal pipeline keys. They are not applicant-facing
tracking IDs and must not be presented in public dashboards.

## Explicitly excluded admission fields

The extraction boundary excludes:

- Identity and linkage: `tracking_id`, `user_id`, `first_name`, `middle_name`,
  `last_name`, `student_number`, and `lrn`.
- Contact and location: `email`, `phone`, and `address`.
- Personal characteristics: `dob` and `gender`.
- Education history: `prev_school`.
- Guardian data: `guardian`, `guardian_relation`, `guardian_phone`, and
  `guardian_email`.
- Unstructured content: `notes`.

This exclusion is enforced in code and tests, not left to query convention.
Adding a field requires an intentional contract and privacy review.

## Validation guarantees

- Unknown analytical fields are rejected.
- Timestamps must include a timezone and follow a valid lifecycle order.
- Admissions may omit both academic references, but cannot contain only one.
- Status and applicant type values are constrained to the operational values
  documented in the Prisma schema.
- Academic-period end dates cannot precede their start dates.

## Synthetic fixtures

`generate_admissions_dataset(seed=..., admission_count=...)` produces only
contract-safe records. A local pseudo-random generator, fixed calendar dates,
and stable source IDs make a given seed byte-for-byte reproducible. Admissions
always reference an existing semester and its academic year, and grade levels
map consistently to junior or senior high school.

Synthetic data is suitable for tests, screenshots, and public demonstrations.
Production applicant data is not.
