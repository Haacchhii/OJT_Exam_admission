-- AlterTable: Add schedule closure fields
ALTER TABLE "exam_schedules" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "exam_schedules" ADD COLUMN "closed_at" TIMESTAMP(3);
ALTER TABLE "exam_schedules" ADD COLUMN "closed_by" INTEGER;
ALTER TABLE "exam_schedules" ADD COLUMN "closure_reason" TEXT;

-- CreateIndex
CREATE INDEX "exam_schedules_status_idx" ON "exam_schedules"("status");

-- AddForeignKey
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
