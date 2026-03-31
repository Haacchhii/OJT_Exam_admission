-- Phase 18 performance indexes for high-frequency filtered queries.

CREATE INDEX IF NOT EXISTS admissions_deleted_status_year_idx
  ON admissions(deleted_at, status, academic_year_id);

CREATE INDEX IF NOT EXISTS exam_registrations_email_status_schedule_idx
  ON exam_registrations(user_email, status, schedule_id);

CREATE INDEX IF NOT EXISTS exam_results_passed_created_idx
  ON exam_results(passed, created_at);
