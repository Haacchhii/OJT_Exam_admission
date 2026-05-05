-- Create table notification_preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NULL,
  UNIQUE (user_id, event_type)
);
CREATE INDEX IF NOT EXISTS notification_preferences_user_idx ON notification_preferences(user_id);

-- Create table admission_comments
CREATE TABLE IF NOT EXISTS admission_comments (
  id SERIAL PRIMARY KEY,
  admission_id INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NULL
);
CREATE INDEX IF NOT EXISTS admission_comments_admission_idx ON admission_comments(admission_id);
CREATE INDEX IF NOT EXISTS admission_comments_user_idx ON admission_comments(user_id);
