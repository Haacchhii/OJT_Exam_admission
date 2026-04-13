# Stakeholder Test Script Pack by Role

Date: April 13, 2026
Purpose: Role-centered scenario scripts to validate real operational outcomes, not just endpoint availability.

## How to Use

For each scenario, record:
- Preconditions
- Steps executed
- Expected behavior
- Actual behavior
- Pass/Fail
- Severity if failed (Critical, High, Medium, Low)

---

## A. Applicant Scripts

### A1. First-time onboarding and gated progression
- Preconditions: New applicant account; active exam/admission period.
- Steps:
1. Register account.
2. Log in.
3. Try opening admission before completing exam.
4. Book exam schedule.
5. Complete exam.
6. Return to admission form.
- Expected:
1. Admission is blocked before exam completion with clear instruction.
2. Admission becomes available after exam completion.

### A2. Period-bound behavior
- Preconditions: Active semester exists, then simulate closed period.
- Steps:
1. Attempt exam booking outside active period.
2. Attempt admission submission outside active period.
- Expected:
1. Both actions are blocked with explicit, non-technical messages.

### A3. Interruption resilience
- Preconditions: Applicant starts admission wizard.
- Steps:
1. Fill partial form.
2. Close browser/tab.
3. Reopen and return to admission form.
- Expected:
1. Draft is restored.
2. No silent field loss on required sections.

### A4. Tracking and transparency
- Preconditions: Submitted admission with tracking ID.
- Steps:
1. Open tracker using tracking ID.
2. Verify stage and latest notes.
- Expected:
1. Tracker reflects current backend status.
2. Messaging is understandable to non-technical users.

---

## B. Registrar Scripts

### B1. Queue triage and detail review
- Preconditions: Multiple admissions in mixed statuses.
- Steps:
1. Filter by status, grade, year, semester.
2. Open admission detail from list.
3. Validate document review and notes.
- Expected:
1. Filters combine correctly.
2. Detail opens reliably from list for each selected record.

### B2. Transition controls
- Preconditions: Admission in each state (Submitted, Screening, Evaluation).
- Steps:
1. Attempt invalid status jump.
2. Apply valid next-step transition.
- Expected:
1. Invalid transition is blocked.
2. Valid transition succeeds and updates list/detail consistently.

### B3. Bulk actions with mixed eligibility
- Preconditions: Select records with different current statuses.
- Steps:
1. Apply bulk status change.
2. Observe skipped/non-eligible records.
- Expected:
1. Eligible records update.
2. Ineligible records are clearly reported.

---

## C. Teacher Scripts

### C1. Exam setup integrity
- Preconditions: Teacher account; one new exam draft.
- Steps:
1. Create exam with MC and essay items.
2. Set duration and passing score.
3. Publish schedule with visibility and registration windows.
- Expected:
1. Validation blocks malformed windows.
2. Published schedule reflects configured constraints.

### C2. Essay scoring workflow
- Preconditions: Completed student exam with pending essays.
- Steps:
1. Open essay review queue.
2. Score essay and add comments.
3. Reopen to verify persistence.
- Expected:
1. Scores and comments persist.
2. Result recalculation matches displayed totals.

### C3. Edge scheduling checks
- Preconditions: Full schedule and closed window schedule.
- Steps:
1. Verify student cannot book full schedule.
2. Verify student cannot book when not visible/registration closed.
- Expected:
1. Block reasons are accurate and user-readable.

---

## D. Administrator Scripts

### D1. User governance and safety controls
- Preconditions: Admin account with multiple user records.
- Steps:
1. Create/edit/deactivate a user.
2. Attempt self-delete single and bulk contexts.
- Expected:
1. Governance actions are audited.
2. Self-delete is blocked in all paths.

### D2. Academic period operations
- Preconditions: At least two academic years and semesters.
- Steps:
1. Switch active year/semester.
2. Validate downstream effects on booking/admissions.
- Expected:
1. Period changes propagate consistently.
2. Student workflows honor active period constraints.

### D3. Audit confidence
- Preconditions: Perform create/update/delete actions across modules.
- Steps:
1. Open audit log.
2. Verify actor, action, timestamp, entity, and details.
- Expected:
1. No missing audit entries for sensitive actions.

---

## E. Cross-Role Conflict Scripts

### E1. API bypass guard test
- Preconditions: Applicant who has not completed exam.
- Steps:
1. Attempt direct POST to admissions endpoint with valid payload.
- Expected:
1. Backend rejects submission due to incomplete exam requirement.

### E2. Policy toggle consistency test
- Preconditions: Run once with EMAIL_VERIFICATION_REQUIRED=true and once with false.
- Steps:
1. Register applicant.
2. Attempt login before email verification.
- Expected:
1. Required=true: blocked until verified.
2. Required=false: not blocked by verification requirement.

### E3. Report freshness check
- Preconditions: Latest stakeholder suite executed.
- Steps:
1. Compare report summary versus actual latest test output.
- Expected:
1. Report reflects current run status without stale failures.

---

## Exit Criteria for Stakeholder Signoff

- All Critical and High scenarios pass.
- No unresolved role-permission mismatches in docs versus runtime behavior.
- Latest report artifacts align with latest executed evidence.
