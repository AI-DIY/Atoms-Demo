ALTER TABLE "Project" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "Project" ADD COLUMN "publishedVersion" INTEGER;
ALTER TABLE "Project" ADD COLUMN "publishedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "appStateJson" TEXT NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX "Project_shareToken_key" ON "Project"("shareToken");
CREATE INDEX "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt");
