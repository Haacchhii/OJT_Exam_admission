-- Create table notification_role_preferences
CREATE TABLE IF NOT EXISTS notification_role_preferences (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  event_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NULL,
  UNIQUE (role, event_type)
);
CREATE INDEX IF NOT EXISTS notification_role_preferences_role_idx ON notification_role_preferences(role);
