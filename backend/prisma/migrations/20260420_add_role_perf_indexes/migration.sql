-- Role-focused performance indexes for admin/registrar/teacher hot paths.

-- Users list and stats views
CREATE INDEX IF NOT EXISTS users_deleted_created_idx
  ON users(deleted_at, created_at);

CREATE INDEX IF NOT EXISTS users_deleted_role_created_idx
  ON users(deleted_at, role, created_at);

CREATE INDEX IF NOT EXISTS users_deleted_status_created_idx
  ON users(deleted_at, status, created_at);

CREATE INDEX IF NOT EXISTS users_deleted_role_idx
  ON users(deleted_at, role);

-- Case-insensitive user lookups used by ownership and staff search flows
CREATE INDEX IF NOT EXISTS users_email_lower_idx
  ON users(LOWER(email));

-- Exam registration readiness and ownership views
CREATE INDEX IF NOT EXISTS exam_registrations_status_created_idx
  ON exam_registrations(status, created_at);

CREATE INDEX IF NOT EXISTS exam_registrations_user_id_created_idx
  ON exam_registrations(user_id, created_at);

CREATE INDEX IF NOT EXISTS exam_registrations_user_id_status_created_idx
  ON exam_registrations(user_id, status, created_at);

CREATE INDEX IF NOT EXISTS exam_registrations_user_email_created_idx
  ON exam_registrations(user_email, created_at);

-- Case-insensitive fallback ownership lookup on legacy/mixed-case emails
CREATE INDEX IF NOT EXISTS exam_registrations_user_email_lower_idx
  ON exam_registrations(LOWER(user_email));

-- Audit list filters with descending time scans
CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx
  ON audit_logs(user_id, created_at);

CREATE INDEX IF NOT EXISTS audit_logs_entity_created_idx
  ON audit_logs(entity, created_at);

CREATE INDEX IF NOT EXISTS audit_logs_action_created_idx
  ON audit_logs(action, created_at);
