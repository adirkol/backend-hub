-- CreateEnum
CREATE TYPE "SDKPublishStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "SDKPublish" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "releaseNotes" TEXT,
    "publishedBy" TEXT NOT NULL,
    "status" "SDKPublishStatus" NOT NULL DEFAULT 'PENDING',
    "commitSha" TEXT,
    "tagName" TEXT,
    "workflowRunId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SDKPublish_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SDKPublish_version_key" ON "SDKPublish"("version");

-- CreateIndex
CREATE INDEX "SDKPublish_status_idx" ON "SDKPublish"("status");

-- CreateIndex
CREATE INDEX "SDKPublish_createdAt_idx" ON "SDKPublish"("createdAt");
