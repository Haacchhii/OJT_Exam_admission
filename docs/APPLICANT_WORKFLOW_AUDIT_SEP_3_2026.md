# Applicant Workflow Audit — September 3, 2026

## Scope

Post-merge production health verification and the next applicant/student workflow slice:
authentication, admission eligibility, exam ownership/window controls, autosave/submission,
tracking, result privacy, and document access.

## Production Evidence

- `https://ojt-exam-admission.vercel.app/` returned HTTP 200.
- `/api/health` returned HTTP 200 with `status: ok` and `db: connected`.
- Five consecutive health samples passed in 243–926 ms. This does not yet satisfy the
  plan's sub-500 ms p95 target and should be revisited in the performance phase.
- The documented Sofia applicant account did not authenticate in production on September 3.
  The read-only Playwright journey therefore passed logout/protected-route behavior but could
  not validate authenticated dashboard, admission, exam, results, tracking, or profile pages.
- No production records were created, updated, or deleted during this audit.

## Automated Evidence

- Applicant-focused backend slice: 48/48 tests passed.
- Focused verification after the fix: 41/41 tests passed.
- Broader isolated backend run: 125 tests passed; the Redis timeout test exceeded its 250 ms
  limit under parallel load and then passed alone in 139 ms. Track this as existing test
  flakiness rather than an applicant regression.
- Prisma schema validation passed when both placeholder test database URLs were supplied.

## Defect Fixed

Admission submission previously accepted any completed exam owned by the applicant. A completed
exam for another grade or an earlier academic term could satisfy the entrance-exam gate.

The gate now requires all of the following:

- the registration is owned by the authenticated applicant;
- the registration is complete;
- the exam targets the applicant's exact grade, its supported legacy grade bucket, or all levels;
- the exam belongs to the active academic year and semester; and
- the exam has not been soft-deleted.

Regression coverage records compatible junior-high and senior-high grade scopes and the complete
Prisma ownership/grade/term filter.

## Remaining Blockers

1. Refresh or provision an authorized production/staging applicant test account and provide it
   through the `E2E_APPLICANT_EMAIL` and `E2E_APPLICANT_PASSWORD` environment variables.
2. Verify the deployed migration history with authorized read-only database/deployment access.
3. Re-run the authenticated Playwright journey against the deployed revision.
4. Use a dedicated non-production dataset before running mutation scenarios such as booking,
   final exam submission, admission submission, document upload, or cleanup.

## Status

**Partial.** Static tracing, isolated applicant rules, and public production health checks are
complete. Authenticated deployed workflow verification remains blocked by stale test credentials.
