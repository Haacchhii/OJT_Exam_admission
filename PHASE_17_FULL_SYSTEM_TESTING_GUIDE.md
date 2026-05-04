**Phase 17 — Full System Testing Guide**

- **Scope**: End-to-end verification for Admissions, Exams (build/publish), Results (auto+essay scoring), Registrar handoff & records, and Admin user provisioning (force password, set role). Includes sanity checks for cache invalidation, notifications, and audit logging.

- **Prerequisites**:
- Run the app in dev or deploy preview connected to a test DB.
- Ensure at least one admin, one registrar, one teacher, and two applicant test accounts exist.
- Reset caches (if applicable) and ensure background workers/email mocks are reachable.

- **Common test accounts**:
- **Admin**: email: admin@example.com, role: administrator
- **Registrar**: registrar@example.com, role: registrar
- **Teacher**: teacher@example.com, role: teacher
- **Applicant A/B**: applicant1@example.com, applicant2@example.com

- **Quick smoke**:
- **Start server**: Launch backend + frontend. Confirm health endpoints respond.
- **Login**: Sign in as Admin, Teacher, Registrar, Applicant to confirm auth flows.

**Admissions**
- **Create application**: As Applicant, submit application; check admission record created.
- **View in staff**: As Registrar, open Admissions list; confirm new application appears.
- **Registrar handoff**: From Admission detail (staff view) click "Handoff" → verify:
  - **UI**: Admission detail updates immediately (note added, status changes if expected).
  - **API**: POST /api/admissions/:id/handoff returns updated Admission object.
  - **Cache**: Admissions list reflects change after action.
  - **Audit**: Check audit logs (backend) for `admission.handoff` entry.

**Exam Builder & Publish**
- **Create exam + schedule**: Build an exam with objective and essay questions.
- **Assign & Publish**: Use "Assign & Publish" button → verify:
  - Exam `isActive` becomes true in DB.
  - Students in assigned groups receive schedule (or queue entry).
  - Cache invalidation for exam lists.

**Result Submission & Scoring**
- **Submit exam**: As Applicant, take assigned exam; include essay answers.
- **Auto-graded results**: Confirm multiple-choice auto-grading runs and totals computed.
- **Essay scoring (teacher)**:
  - Open Scoring Queue (`/employee/results#essays`) as Teacher.
  - Score an unscored essay: set points/comment → Save.
    - **UI**: Score appears immediately in scoring list.
    - **API**: PATCH /api/results/essays/:id/score updates EssayAnswer and returns updated entity.
    - **Recalc**: If last essay scored, ExamResult recalculates totals and sends result notification.
  - Edit an already-scored essay: change points → Save.
    - Verify updated points persist and UI reflects new value without full reload.
    - If not immediate, confirm cache invalidation keys: `results:answers:{registrationId}` and `resultsEmployeeSummary:` are updated in backend logs.

**Admin — Users**
- **Set role**: As Admin, change a user's role via Users page; verify role change in DB and UI.
- **Force password reset**: From Edit User modal, click "Force Password" → confirm user gets `mustChangePassword=true` and next login prompts password change.
- **Visibility**: Confirm buttons visible only to Admins (and actionable) and accessible on narrow viewports (overflow menu if applicable).

**Registrar Records**
- **Accepted list**: Confirm RegistrarRecords page shows accepted admissions.
- **Owner/Ownership**: Check that created-by / handoff timestamps are recorded.

**Notifications & Emails**
- Confirm result notification emails are sent (or queued) when results finalize.
- Confirm any handoff or publish notifications are logged/sent as configured.

**DB / Migrations**
- For local dev where shadow DB mismatches occur: Prefer `npx prisma db push` to apply schema changes for testing, then run `npx prisma generate`.
- Verify `tokenVersion`, `mustChangePassword`, and any newly added columns exist and are populated as expected.

**Cache & Concurrency**
- Simulate two concurrent scorers editing the same essay: ensure last write wins and audit logs show both edits.
- Confirm cache invalidation triggers for:
  - `results:answers:{registrationId}`
  - `results:mine:{userId}`
  - `resultsEmployeeSummary:`
  - `admissions:list` / `admissions:detail:{id}`

**Security & RBAC**
- Attempt admin-only actions (set role, force reset, publish) as non-admin: expect 403 Forbidden.
- Applicant-only endpoints: ensure applicants cannot access other users' registrations.

**Regression Checklist (Run after fixes)**
- Admission handoff updates UI immediately and audit logged.
- Exam publish toggles `isActive` and assigns schedule entries.
- Scoring: initial and edited essay scores persist and exam totals update when all essays scored.
- Admin actions visible and functional for admins; hidden/forbidden for others.

**Troubleshooting**
- If a change doesn't appear after an action: 1) check response body from API call; 2) check cache keys invalidated in backend logs; 3) perform an explicit refetch in UI or reload page.
- If Prisma migrate fails due to shadow DB mismatch: use `prisma db push` for quick iteration.

**Acceptance Criteria**
- All flows above pass with at least one test account per role.
- No 500-level errors during common flows.
- Audit logs contain entries for handoff, essay.score, exam.publish, and user.role-change.

**Recommended E2E tests to automate**
- Admission submit -> Registrar handoff -> RegistrarRecords show entry.
- Exam create -> Assign & Publish -> Applicant completes exam -> Teacher scores -> ExamResult finalizes.
- Admin changes user role and forces password reset.

---
Notes: If you want, I can convert this into a runnable Playwright script and produce a checklist that maps to each test case with exact selectors and API request examples.
