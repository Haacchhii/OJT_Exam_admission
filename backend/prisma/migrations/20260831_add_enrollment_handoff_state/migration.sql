ALTER TABLE "admissions"
ADD COLUMN IF NOT EXISTS "enrollment_handoff_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "enrollment_handoff_by_id" INTEGER;

CREATE INDEX IF NOT EXISTS "admissions_enrollment_handoff_at_idx" ON "admissions"("enrollment_handoff_at");
CREATE INDEX IF NOT EXISTS "admissions_enrollment_handoff_by_id_idx" ON "admissions"("enrollment_handoff_by_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admissions_enrollment_handoff_by_id_fkey'
  ) THEN
    ALTER TABLE "admissions"
    ADD CONSTRAINT "admissions_enrollment_handoff_by_id_fkey"
    FOREIGN KEY ("enrollment_handoff_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
