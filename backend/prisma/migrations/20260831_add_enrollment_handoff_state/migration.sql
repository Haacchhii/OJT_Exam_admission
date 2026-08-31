ALTER TABLE "admissions"
ADD COLUMN "enrollment_handoff_at" TIMESTAMP(3),
ADD COLUMN "enrollment_handoff_by_id" INTEGER;

CREATE INDEX "admissions_enrollment_handoff_at_idx" ON "admissions"("enrollment_handoff_at");
CREATE INDEX "admissions_enrollment_handoff_by_id_idx" ON "admissions"("enrollment_handoff_by_id");

ALTER TABLE "admissions"
ADD CONSTRAINT "admissions_enrollment_handoff_by_id_fkey"
FOREIGN KEY ("enrollment_handoff_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
