ALTER TABLE "exam_schedules"
  ADD COLUMN IF NOT EXISTS "exam_window_start_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "exam_window_end_at" TIMESTAMP(3);

-- Backfill to preserve existing behavior:
-- start = registration open date at 00:00 when present, otherwise scheduled date + start time.
UPDATE "exam_schedules"
SET "exam_window_start_at" = CASE
  WHEN "registration_open_date" IS NOT NULL
    THEN ("registration_open_date" || ' 00:00:00')::timestamp
  ELSE ("scheduled_date" || ' ' || COALESCE("start_time", '00:00'))::timestamp
END
WHERE "exam_window_start_at" IS NULL;

-- end = registration close date at 23:59:59.999 when present, otherwise scheduled date + end time.
UPDATE "exam_schedules"
SET "exam_window_end_at" = CASE
  WHEN "registration_close_date" IS NOT NULL
    THEN ("registration_close_date" || ' 23:59:59.999')::timestamp
  ELSE ("scheduled_date" || ' ' || COALESCE("end_time", '23:59'))::timestamp
END
WHERE "exam_window_end_at" IS NULL;

-- Safety guard for malformed historical rows.
UPDATE "exam_schedules"
SET "exam_window_end_at" = "exam_window_start_at" + INTERVAL '1 hour'
WHERE "exam_window_start_at" IS NOT NULL
  AND "exam_window_end_at" IS NOT NULL
  AND "exam_window_end_at" <= "exam_window_start_at";

CREATE INDEX IF NOT EXISTS "exam_schedules_exam_window_start_at_idx"
  ON "exam_schedules" ("exam_window_start_at");

CREATE INDEX IF NOT EXISTS "exam_schedules_exam_window_end_at_idx"
  ON "exam_schedules" ("exam_window_end_at");
