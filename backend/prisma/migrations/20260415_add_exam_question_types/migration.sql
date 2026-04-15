-- Add support fields for new exam question types.

ALTER TABLE exam_questions
  ADD COLUMN IF NOT EXISTS identification_answer TEXT,
  ADD COLUMN IF NOT EXISTS identification_match_mode TEXT;
