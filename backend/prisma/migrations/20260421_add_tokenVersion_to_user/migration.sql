-- AddColumn tokenVersion to User model
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 1;
