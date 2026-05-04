# Role-Based Test Plan

## Overview
This repository implements an online exam and admissions system with role-based access control. Core features include: admissions processing and handoff, exam building/assignment/publish, exam taking and auto-grading, essay scoring and results calculation, and admin user provisioning (force password reset, set role). The plan below covers primary user roles and their workflows.

## User Roles Covered
- Administrator
- Registrar
- Teacher
- Applicant

## Test Environment Requirements
- Test instance of backend and frontend running against a test Postgres database.
- Test accounts for each role (administrator, registrar, teacher, applicant1, applicant2).
- Mailer/service mocks or a test SMTP sink for email notifications.
- Redis or in-memory cache reset between major tests (if applicable).
- Developer tools available: `psql`, `npx prisma` (for DB pushes), and ability to view backend logs for audit entries.

---

## How to use this test plan
- For each test case, fill in the "Actual Result" and "Status" columns when executing the test.
- Execute tests in the order presented within each role (happy path first), but edge cases and error handling should be run as well.

---

## Administrator Test Cases

| Test Case ID | Title | User Role | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|---|
| TC-ADMIN-001 | Login and dashboard access | Administrator | Admin account exists and is active | 1. Login as admin. 2. Open dashboard. | Admin dashboard loads with management links (Users, Admissions, Exams, Reports). |  |  |
| TC-ADMIN-002 | Create a new user (happy path) | Administrator | Logged in as admin | 1. Go to Users page. 2. Click Add User, fill valid details (email, name, role). 3. Save. | New user appears in list, verification email queued (if applicable), DB user record created. |  |  |
| TC-ADMIN-003 | Set user role | Administrator | User exists | 1. Open existing user. 2. Change role (e.g., applicant -> teacher). 3. Save. | Role updates in UI and DB. Audit log contains user.role-change entry. |  |  |
| TC-ADMIN-004 | Force password reset | Administrator | User exists | 1. Open Edit User modal. 2. Click Force Password. Confirm. | The user's `mustChangePassword` flag is set to true in DB; next login prompts password change. |  |  |
| TC-ADMIN-005 | Unauthorized access blocked | Administrator (negative test) | Logged in as non-admin (e.g., teacher) | 1. Attempt to access admin-only APIs (set-role, force-password) via UI or API. | 403 Forbidden returned; UI hides admin controls. |  |  |
| TC-ADMIN-006 | Boundary: create user with maximum field lengths | Administrator | Logged in as admin | 1. Add User with long name and email near DB limits. 2. Save. | Record accepted or rejected gracefully with clear validation errors; no 500 errors. |  |  |
| TC-ADMIN-007 | Error handling: create user with invalid email | Administrator | Logged in as admin | 1. Attempt to create user with malformed email. 2. Submit. | Validation error displayed; user not created. |  |  |

---

## Registrar Test Cases

| Test Case ID | Title | User Role | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|---|
| TC-REG-001 | View admissions list | Registrar | Logged in as registrar; at least one admission exists | 1. Login as registrar. 2. Open Admissions list. | Admissions list loads and shows applications; pagination works. |  |  |
| TC-REG-002 | Admission detail view | Registrar | Admission exists | 1. Click an admission item. 2. View detail. | Detail page shows applicant info, notes, status, handoff actions. |  |  |
| TC-REG-003 | Registrar handoff (happy path) | Registrar | Admission in "accepted" or appropriate state | 1. Open admission detail. 2. Click Handoff. Confirm action. | UI updates immediately to show handoff note; backend returns updated Admission object; audit log has `admission.handoff`. |  |  |
| TC-REG-004 | Handoff API error handling | Registrar | Admission exists | 1. Simulate backend failure (disable DB or return 500). 2. Attempt handoff. | UI shows an error toast; admission state unchanged; no partial updates left. |  |  |
| TC-REG-005 | RegistrarRecords filter & export | Registrar | Multiple admissions across statuses | 1. Open Registrar Records page. 2. Filter by status=accepted and export. | Filtered list shows only matching records and export downloads correct CSV/JSON. |  |  |
| TC-REG-006 | Edge: handoff when another user already handed off | Registrar | Admission already handed off by another registrar | 1. Attempt to handoff same admission. 2. Observe behavior. | System prevents duplicate handoff or records both with timestamps; UI indicates existing handoff. |  |  |
| TC-REG-007 | Unauthorized: applicant cannot handoff | Applicant (negative) | Applicant logged in | 1. Attempt to call /api/admissions/:id/handoff via UI or API. | 403 Forbidden returned. |  |  |

---

## Teacher Test Cases

| Test Case ID | Title | User Role | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|---|
| TC-TEACHER-001 | Access scoring queue | Teacher | Teacher account exists; at least one exam with essay answers submitted | 1. Login as teacher. 2. Open Scoring Queue (/employee/results#essays). | Scoring queue lists pending essay answers with links to open scoring modal. |  |  |
| TC-TEACHER-002 | Score an unscored essay (happy path) | Teacher | Essay answer exists and is unscored | 1. Open the essay in scoring modal. 2. Enter points within range and optional comment. 3. Save. | Points saved; modal closes; scoring list updated immediately; DB EssayAnswer updated; audit log `essay.score`. |  |  |
| TC-TEACHER-003 | Edit an already-scored essay | Teacher | Essay already scored | 1. Open scored essay. 2. Change points or comment. 3. Save. | Updated points persist and UI reflects change immediately; examResult recalculates if necessary. |  |  |
| TC-TEACHER-004 | Boundary: scoring beyond question max points | Teacher | Essay question has defined max points | 1. Attempt to save a score greater than max points. | Backend validation caps or rejects invalid points with clear error; UI displays error. |  |  |
| TC-TEACHER-005 | Concurrency: two teachers edit same essay | Teacher | Essay exists | 1. Teacher A opens essay. 2. Teacher B opens same essay and saves a change. 3. Teacher A saves afterwards. | Last write wins; audit log records both events. Consider conflict UI if implemented. |  |  |
| TC-TEACHER-006 | Essay regrading triggers result recalculation | Teacher | All essays for a registration are scored after this edit | 1. Score the final essay for a registration. 2. Observe result updates. | ExamResult totals recomputed; percentage and pass/fail flags updated; notification/email sent as configured. |  |  |
| TC-TEACHER-007 | Error handling: save score with invalid data | Teacher | Scoring modal open | 1. Submit non-numeric points or empty comment if required. | Validation error shown; no DB change; no crash. |  |  |

---

## Applicant Test Cases

| Test Case ID | Title | User Role | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|---|
| TC-APPL-001 | Register and login | Applicant | None | 1. Register as a new applicant. 2. Confirm registration email (if required). 3. Login. | Account created and login successful; onboarding flows shown as applicable. |  |  |
| TC-APPL-002 | Submit application (Admissions) | Applicant | Logged in | 1. Fill and submit application form. 2. Save. | Application saved; admissions record created; confirmation shown; staff viewable. |  |  |
| TC-APPL-003 | Take an assigned exam (happy path) | Applicant | Exam assigned and active | 1. Open assigned exam. 2. Answer objective questions and one or more essay questions. 3. Submit before timeout. | Submission accepted; auto-graded questions evaluated; essays stored for teacher scoring; submission timestamp recorded. |  |  |
| TC-APPL-004 | Boundary: exam timeout behavior | Applicant | Exam with time limit | 1. Start exam. 2. Wait until time expires. | System auto-submits or locks answers; partial answers saved per UX; user notified. |  |  |
| TC-APPL-005 | Attempt to access another user's result | Applicant (negative) | Applicant logged in | 1. Attempt to open /api/results/:registrationId for a different user. | 403 Forbidden returned. |  |  |
| TC-APPL-006 | View final results | Applicant | Result finalized | 1. Open Results page. 2. View scores and breakdown. | Correct totals and details presented; downloadable certificate or email sent if configured. |  |  |
| TC-APPL-007 | Error: submit with missing required answers | Applicant | Exam in-progress | 1. Try to submit without answering required questions. | Client-side validation prevents or warns; server-side validation blocks and returns clear errors. |  |  |

---

## Cross-Role & System Test Cases
(These apply across roles and verify system-wide behaviors.)

| Test Case ID | Title | User Role | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|---|
| TC-SYS-001 | Audit logging for critical actions | Admin/Registrar/Teacher | Actions available to roles | 1. Perform actions: admission.handoff, essay.score, exam.publish, user.role-change. 2. Inspect audit logs. | Each action produces an audit entry with actor, timestamp, and details. |  |  |
| TC-SYS-002 | Cache invalidation after actions | Any | Cache layer enabled | 1. Perform an action that changes list/detail (publish exam, handoff admission, score essay). 2. Read list/detail endpoints. | Caches invalidated or updated; API returns fresh state. |  |  |
| TC-SYS-003 | Email notifications triggered | System | SMTP mocked or test sink | 1. Trigger result finalization and handoff notifications. 2. Inspect email sink. | Expected emails queued/sent with correct recipient and content. |  |  |
| TC-SYS-004 | RBAC enforcement (API-level) | Any | Test accounts per role | 1. Attempt role-specific API calls with lower-privilege tokens. | 403 Forbidden; logs show attempted violations. |  |  |
| TC-SYS-005 | DB migration fallback behavior | DevOps | Schema changed locally causing shadow DB errors | 1. Run `npx prisma migrate dev` and simulate shadow DB mismatch. 2. Run `npx prisma db push`. | `db push` applies schema for testing; `prisma generate` runs successfully. |  |  |

---

## Recommended Execution Notes
- Run happy paths first to verify core flows. Then execute edge and error cases.
- Use separate test DB snapshots or transactions to reset state between major tests.
- Record exact API requests and responses for any failing cases to aid debugging.
- For concurrency tests, use two browser sessions or automated scripts simulating two users.

---

## Appendix: ID mapping and conventions
- Test Case IDs use format `TC-<ROLE>-NNN`.
- Status values: Pass / Fail / Blocked.

---

*End of test plan.*
