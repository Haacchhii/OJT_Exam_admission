# Golden Key Role-Based Test Plan

Version: April 15, 2026

## Purpose
Validate that each system role can access only the pages and actions intended for that role, and that the main workflows complete correctly without permission leaks, stale UI, or backend failures.

## Roles Covered
- Applicant
- Registrar
- Teacher
- Administrator

## Test Environment
- Frontend server running
- Backend server running
- Database seeded with test accounts and sample data
- At least one active academic year and semester
- At least two exams, two schedules, admissions records, and results records

## Test Data Needed
- One applicant account with no completed exam
- One applicant account with completed exam and admission record
- One registrar account
- One teacher account
- One administrator account

## What to Verify for Every Role
- Login works with the correct account
- The role lands on the correct workspace after login
- Allowed pages open without errors
- Forbidden pages show access restriction or are hidden entirely
- Allowed actions succeed and persist after refresh
- Forbidden actions are rejected by the UI and backend
- No page shows an unrelated permission error caused by another role’s endpoint

## Execution Order
1. Authentication and session checks
2. Default landing page checks
3. Allowed page access checks
4. Forbidden page access checks
5. Role-specific workflow checks
6. Negative permission checks
7. Regression pass for changed areas

## Pass Criteria
A case passes when:
- The role can complete the intended task
- The role cannot access restricted pages or actions
- The result persists after refresh or re-login where applicable
- Error messages are clear and non-technical

## Fail Criteria
A case fails when:
- Access is blocked for a permitted role
- Restricted access is granted to the wrong role
- The page loads but the intended action cannot be completed
- A backend rejection appears as a generic or misleading error
- Saved data does not persist or reappear correctly

## Role Access Matrix

| Role | Allowed Pages | Primary Responsibilities |
| --- | --- | --- |
| Applicant | Dashboard, Online Exam, My Admission, My Results, Track Application, Profile | Apply, book exams, take exams, check results, track status |
| Registrar | Dashboard, Admissions, Results, Reports, Profile | Review admissions, manage records, export reports |
| Teacher | Dashboard, Exams, Results, Reports, Profile | Create exams, manage schedules, score essays, review analytics |
| Administrator | Dashboard, Admissions, Exams, Results, Reports, Users, Audit Log, Settings, Profile | Full system administration and governance |

## Applicant Test Plan

### A1. Login and session
- Log in with the applicant account.
- Confirm the student workspace opens.
- Log out and confirm protected pages no longer open.
- Refresh after logout and confirm the session is gone.

Expected:
- Applicant can log in and only sees the student workspace.
- Session cleanup works consistently.

### A2. Exam booking
- Open Online Exam.
- View available schedules.
- Book an open schedule.
- Try to book a closed or full schedule.

Expected:
- Open schedules can be booked.
- Closed or full schedules are blocked with a clear reason.

### A3. Exam start and submit
- Start the exam within the allowed window.
- Answer questions and submit.
- Try to start outside the allowed window.

Expected:
- Valid starts and submissions succeed.
- Out-of-window attempts are blocked.

### A4. Admission submission
- Open My Admission.
- Complete required fields.
- Upload documents if required.
- Submit the admission.
- Reopen the page and confirm the record remains visible.

Expected:
- Valid submission persists.
- Missing fields or invalid data are rejected clearly.

### A5. Results and tracking
- Open My Results after exam processing.
- Open Track Application with the tracking ID.
- Confirm the shown status matches backend state.

Expected:
- Student sees only their own records.
- Status labels are readable and correct.

### A6. Negative checks
- Try to open staff pages directly.
- Try to view another applicant’s record.

Expected:
- Access is denied.
- No cross-account data is visible.

## Registrar Test Plan

### R1. Login and dashboard
- Log in with the registrar account.
- Confirm the employee workspace opens.
- Verify the dashboard loads without a permission error.

Expected:
- Registrar lands on the correct dashboard.
- No teacher-only or admin-only page is exposed.

### R2. Admissions queue
- Open Admissions.
- Filter by status, grade level, academic year, and semester.
- Search by name and email.
- Open an admission detail.

Expected:
- Filters and search return the correct records.
- Detail pages load consistently.

### R3. Admissions updates
- Move an admission through valid transitions.
- Try an invalid transition.
- Add notes when updating status.

Expected:
- Valid transitions save.
- Invalid transitions are blocked.
- Notes persist after refresh.

### R4. Document review
- Open uploaded documents.
- Review or reject documents with notes.
- Refresh and verify the review state remains.

Expected:
- Document review state is saved and visible.

### R5. Results and reports
- Open Results and Reports.
- Export filtered data to CSV and PDF.
- Confirm the export reflects the selected filters.

Expected:
- Exported data matches the current filter set.
- No unrelated records appear.

### R6. Negative checks
- Try to open Users, Audit Log, or Settings.
- Try teacher-only exam authoring actions.

Expected:
- Restricted pages stay blocked.
- Unauthorized actions fail safely.

## Teacher Test Plan

### T1. Login and dashboard
- Log in with the teacher account.
- Confirm the employee workspace opens.
- Verify the dashboard loads without showing admissions permission errors.

Expected:
- Teacher lands on the correct dashboard.
- Dashboard does not call or depend on registrar-only admissions list behavior.

### T2. Exams workspace access
- Open Exams.
- Verify the exams list loads.
- Confirm teacher-only tabs and actions are available.

Expected:
- Exams page loads successfully.
- Teacher can access exam management tools.

### T3. Create or edit exam
- Create a new exam or edit an existing one.
- Add or update multiple question types.
- Save and reopen the exam.

Expected:
- Changes persist.
- Validation blocks incomplete or invalid exam data.

### T4. Schedule management
- Create a schedule with valid dates and times.
- Try invalid or incomplete schedule data.
- Verify schedule visibility and registration windows.

Expected:
- Valid schedules save.
- Invalid schedules are rejected with clear feedback.

### T5. Essay scoring and results review
- Open pending essays.
- Score an essay and add comments.
- Refresh and confirm the score remains.
- Check analytics or result summaries if available.

Expected:
- Scores persist.
- Result totals update correctly.

### T6. Negative checks
- Try to open Admissions list and admin settings.
- Try to access registrar-only workflows.

Expected:
- Restricted pages are blocked.
- No teacher action leaks into registrar permissions.

## Administrator Test Plan

### A1. Login and dashboard
- Log in with the administrator account.
- Confirm the full employee workspace opens.
- Verify all admin-allowed modules appear.

Expected:
- Administrator sees the full intended workspace.

### A2. User management
- Open Users.
- Create or update a user.
- Change role or status.
- Verify the updated account can log in with the new role.

Expected:
- User updates persist.
- Role changes take effect correctly.

### A3. Academic setup
- Open Settings.
- Create or edit academic years and semesters.
- Mark the active year and semester.
- Confirm date constraints are respected.

Expected:
- Academic period changes save and propagate.

### A4. Admissions, exams, results, and reports
- Open each module.
- Perform one allowed action in each area.
- Export a report or list.

Expected:
- Admin can access all intended operational and oversight pages.
- Exports are accurate.

### A5. Audit and governance
- Open Audit Log.
- Confirm recent actions are visible.
- Check that sensitive operations are recorded.

Expected:
- Governance activity is traceable.

### A6. Negative checks
- Attempt self-delete if supported by the UI.
- Confirm any dangerous action requires confirmation or is blocked by policy.

Expected:
- Safety controls remain intact.

## Cross-Role Regression Checks
Run these after permissions, routing, workflow, or status logic changes:
- Login and logout for every role
- Direct URL access to restricted pages for every role
- Dashboard rendering for every role
- One allowed workflow per role
- One forbidden page per role
- CSV and PDF exports with active filters
- Session timeout and re-login behavior
- Refresh persistence after save or submit

## Recommended Smoke Set
- Applicant: log in, book exam, submit admission
- Registrar: log in, open admissions list, update one status
- Teacher: log in, open exams, score one essay
- Administrator: log in, open users, update one account

## Reporting Template
For each case record:
- Role
- Scenario
- Preconditions
- Steps
- Expected result
- Actual result
- Pass or Fail
- Severity if failed
- Evidence or screenshot reference

## Review Notes
- Treat role-specific permission failures as high priority.
- Treat generic error messages on allowed pages as a regression.
- Treat data mismatches after refresh or re-login as a workflow failure.
