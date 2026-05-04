-- CreateTable
CREATE TABLE "question_templates" (
    "id" SERIAL NOT NULL,
    "created_by" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "identification_answer" TEXT,
    "identification_match_mode" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "choices" TEXT NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_templates_created_by_idx" ON "question_templates"("created_by");

-- CreateIndex
CREATE INDEX "question_templates_question_type_idx" ON "question_templates"("question_type");

-- CreateIndex
CREATE INDEX "question_templates_is_public_idx" ON "question_templates"("is_public");

-- CreateIndex
CREATE INDEX "question_templates_created_at_idx" ON "question_templates"("created_at");

-- AddForeignKey
ALTER TABLE "question_templates" ADD CONSTRAINT "question_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
