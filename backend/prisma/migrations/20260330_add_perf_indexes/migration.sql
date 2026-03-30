-- Performance indexes for common list filters/sorts.

CREATE INDEX IF NOT EXISTS admissions_deleted_status_submitted_idx
  ON admissions(deleted_at, status, submitted_at);

CREATE INDEX IF NOT EXISTS admissions_deleted_level_grade_submitted_idx
  ON admissions(deleted_at, level_group, grade_level, submitted_at);

CREATE INDEX IF NOT EXISTS admissions_deleted_year_sem_submitted_idx
  ON admissions(deleted_at, academic_year_id, semester_id, submitted_at);

CREATE INDEX IF NOT EXISTS exam_schedules_exam_scheduled_date_idx
  ON exam_schedules(exam_id, scheduled_date);

CREATE INDEX IF NOT EXISTS exam_schedules_scheduled_date_exam_idx
  ON exam_schedules(scheduled_date, exam_id);

CREATE INDEX IF NOT EXISTS exam_registrations_schedule_status_idx
  ON exam_registrations(schedule_id, status);

CREATE INDEX IF NOT EXISTS exam_registrations_created_at_idx
  ON exam_registrations(created_at);

CREATE INDEX IF NOT EXISTS essay_answers_registration_scored_idx
  ON essay_answers(registration_id, scored);

CREATE INDEX IF NOT EXISTS essay_answers_scored_created_idx
  ON essay_answers(scored, created_at);
