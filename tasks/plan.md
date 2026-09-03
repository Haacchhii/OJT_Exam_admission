# Completion Plan: OJT Exam Admission System

## Objective

Make every workflow promised by the presentation documents executable end to end for applicants, registrars, teachers, and administrators, while establishing measurable performance and release gates.

## Initial Evidence

- The deployed frontend responds with HTTP 200, but `/api/health` returns HTTP 503 with `{"status":"degraded","db":"disconnected"}`.
- Three health samples took 4.17 s, 3.76 s, and 3.78 s; the server reported 3.35 s of response processing on the inspected response.
- A browser cold navigation to the login page took about 5.74 s until network idle.
- The frontend production build and existing bundle-budget check pass. Total emitted JavaScript is about 1.16 MB; the chart vendor chunk is about 362 KB (110 KB gzip).
- Frontend lint cannot run because ESLint 9 is installed but the repository has no `eslint.config.js`, `.mjs`, or `.cjs` file.
- Backend unit/security checks reach 67 passing tests after Prisma generation. Four production-flow tests require a real seeded database and cannot run against an isolated audit database.
- Clean dependency installation reports 14 frontend vulnerabilities (11 high) and 20 backend vulnerabilities (14 high, 1 critical); each advisory must be triaged before remediation.
- The repository's corrected May 7 production report previously left teacher and registrar journeys blocked and administrator coverage partial. These are historical leads that require re-verification after deployment recovery.

## Audit Progress (August 27, 2026)

- Supabase connectivity has been restored and `/api/health` now reports the database connected.
- Frontend lint, production build, and bundle-budget checks pass. Conditional hook execution in the student exam page was repaired.
- The deployed backend was running in Virginia while Supabase is in Tokyo. The Vercel function region is now configured as Tokyo (`hnd1`) on the audit branch.
- Authenticated academic-period requests were observed hanging beyond 45 seconds. The shared Redis cache had connection timeouts but no command timeouts; bounded command execution and database fallback now have a regression test.
- The isolated backend suite passes 68 tests across nine files. The two production-flow suites remain dependent on a real seeded database.

## Workflow Contract

The following documents are authoritative:

- `docs/ROLE_BASED_TEST_PLAN_APR_2026.md`
- `docs/STAKEHOLDER_TEST_SCRIPT_PACK_BY_ROLE_APR_13_2026.md`
- `PHASE_17_FULL_SYSTEM_TESTING_GUIDE.md`
- `ROLE_BASED_TEST_PLAN.md`
- `TEST_ACCOUNTS_ROLE_BASED_WORKFLOWS.md`

The critical dependency chain is:

1. Deployment configuration and database connectivity
2. Authentication and role routing
3. Active academic/admission/exam periods
4. Applicant registration, admission, scheduling, exam, and results
5. Registrar review, status changes, handoff, and records
6. Teacher exam authoring, publishing, scheduling, and essay scoring
7. Administrator user, period, audit, notification, and governance controls
8. Reporting, exports, observability, and performance regression guards

## Phase 1: Restore a Testable Baseline

### Task 1: Repair production database connectivity

**Acceptance criteria:**

- `/api/health` returns HTTP 200 with database connected.
- Five warm health requests have no failures and p95 server response time below 500 ms.
- Connection failures produce actionable, secret-safe logs.

**Verification:** Public health probes, Vercel/runtime logs, and a read-only database query.

### Task 2: Make local and CI quality gates reproducible

**Acceptance criteria:**

- Clean checkout can generate Prisma Client and run non-production tests with documented commands.
- Frontend lint has a valid ESLint 9 configuration and passes.
- Database-dependent tests explicitly declare and validate their seeded test-database prerequisite.

**Verification:** Clean install, backend tests, frontend lint, frontend build, and bundle budget.

### Checkpoint: Baseline

- Production API is healthy.
- Local/CI verification commands execute deterministically.
- No application behavior has been changed beyond baseline restoration.

## Phase 2: Prove Each Vertical Workflow

### Task 3: Applicant account and admission workflow

Verify registration, email/login behavior, grade-stage routing, admission draft/submission, document handling, and staff visibility.

### Task 4: Applicant exam and result workflow

Verify eligible scheduling, active-window enforcement, autosave/recovery, submission/timeout, objective grading, essay handoff, and final result visibility.

### Task 5: Registrar operational workflow

Verify admissions list/detail, permitted status transitions, comments/documents, acceptance, enrollment handoff, records, and exports.

### Task 6: Teacher operational workflow

Verify exam create/import/edit/publish, schedule management, assignment visibility, essay scoring/regrading, and result finalization.

### Task 7: Administrator governance workflow

Verify user provisioning, role changes, forced password reset, active periods, audit log, settings, and cross-role oversight.

**Acceptance criteria for Tasks 3-7:**

- Every authoritative script is classified Pass, Fail, Partial, Blocked, or Not Applicable with evidence.
- Each failure has a reproducible scenario and root-cause location.
- Cross-role authorization checks reject forbidden operations without data leakage.

### Checkpoint: Functional Contract

- All critical happy paths pass.
- Negative permission and invalid-state paths pass.
- Test data is clearly labeled and cleaned up where safely supported.

## Phase 3: Performance and Hardening

### Task 8: Establish production performance baselines

Measure cold/warm page navigation, Core Web Vitals, authentication, dashboard queries, admissions lists, exam loading/autosave/submission, results, and reports.

### Task 9: Fix measured bottlenecks

Address only profiled causes such as database connection churn, slow queries, unbounded payloads, waterfalls, or oversized route dependencies.

### Task 10: Triage dependency vulnerabilities

Confirm reachability and runtime impact, then apply compatible upgrades with regression verification. Do not use forced major upgrades without an explicit migration plan.

### Task 11: Add release gates and operational monitoring

Add workflow smoke tests, performance budgets, health monitoring, and deployment verification so the system cannot be called complete while critical paths are blocked.

### Final Checkpoint

- All promised role workflows pass against the deployed revision.
- API p95 is below 500 ms for ordinary operations and below 1 s for documented heavy operations.
- LCP is at most 2.5 s, INP at most 200 ms, and CLS at most 0.1 on representative mobile conditions.
- Tests, lint, builds, security triage, deployment smoke tests, and rollback notes are complete.

## Phase 4: Data Integrity and Recovery

### Task 12: Audit production data without mutation

Run read-only checks for orphaned records, invalid role/status combinations, duplicate active
registrations, schedule-window contradictions, incomplete admission handoffs, and notification
ownership. Record counts and stable identifiers without exposing personal data.

### Task 13: Verify migrations and repair tooling

Compare Prisma schema expectations with deployed migration history. Any required repair must be
idempotent, narrowly scoped, dry-run capable, and covered by a regression test before it can be
considered for production.

### Task 14: Prove backup and recovery

Create a backup using the supported project tooling, validate its manifest and record counts, and
restore only into an isolated non-production database. Never overwrite or reset production.

**Acceptance criteria for Tasks 12-14:**

- Every integrity query is read-only and repeatable.
- Every anomaly is classified as defect, expected legacy state, or accepted limitation.
- Backup output excludes secrets and is restorable into an isolated target.
- Restored critical-table counts and representative relationships match the backup manifest.

## Execution Order for the Remaining Audit (September 2026)

1. Applicant/student end-to-end workflow and authorization
2. Cross-role integration, notifications, and cache/realtime consistency
3. Production data integrity and migration/schema consistency
4. Performance, security, backup/recovery, and release readiness

Each implementation slice will begin with a failing regression test, touch no more than five files
where practical, and receive its own verification evidence. Production writes, destructive database
operations, pull-request creation, and merging remain explicit confirmation points.

## Audit Progress (September 3, 2026)

- Post-merge production health is HTTP 200 with the database connected.
- The applicant-focused isolated backend slice passes 48 tests.
- Admission eligibility now requires a completed compatible-grade exam from the active academic
  year and semester; wrong-grade and old-term completions no longer satisfy the gate.
- Authenticated deployed applicant verification is still partial because the documented Sofia
  test account no longer authenticates. See `docs/APPLICANT_WORKFLOW_AUDIT_SEP_3_2026.md`.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Production database credentials/configuration are unavailable or stale | Blocks every workflow | Validate deployment variables and Supabase reachability first |
| Existing test accounts differ from documentation | Blocks role verification | Reconcile accounts through an authorized administrator after API recovery |
| Production data could be affected by testing | Operational/data risk | Use labeled test records and avoid destructive cleanup without explicit confirmation |
| Documents promise inconsistent role scope | False failures or permission leaks | Record conflicts and resolve against presentation intent before changing authorization |
| Performance fixes mask correctness issues | Rework | Restore and prove correctness before optimizing measured bottlenecks |

## Out of Scope

- `CourseFeedback`
- Features not promised in the authoritative documents
- Cosmetic redesign unrelated to completing a workflow or meeting performance/accessibility requirements
