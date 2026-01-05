-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "TokenEntryType" AS ENUM ('GRANT', 'GENERATION_DEBIT', 'GENERATION_REFUND', 'ADMIN_ADJUSTMENT', 'BONUS', 'EXPIRY');

-- CreateEnum
CREATE TYPE "ProviderHealth" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "App" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "apiKey" TEXT NOT NULL,
    "apiKeyPrefix" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultTokenGrant" INTEGER NOT NULL DEFAULT 0,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "rateLimitPerUser" INTEGER NOT NULL DEFAULT 30,
    "rateLimitPerApp" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "App_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "metadata" JSONB,
    "tokenBalance" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenLedgerEntry" (
    "id" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "type" "TokenEntryType" NOT NULL,
    "description" TEXT,
    "jobId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiKeyEnvVar" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastHealthCheck" TIMESTAMP(3),
    "healthStatus" "ProviderHealth" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "modelFamily" TEXT,
    "description" TEXT,
    "tokenCost" INTEGER NOT NULL DEFAULT 1,
    "supportsImages" BOOLEAN NOT NULL DEFAULT true,
    "supportsPrompt" BOOLEAN NOT NULL DEFAULT true,
    "maxInputImages" INTEGER NOT NULL DEFAULT 1,
    "supportedAspectRatios" TEXT[] DEFAULT ARRAY['1:1', '16:9', '9:16', '4:3', '3:4']::TEXT[],
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelProviderConfig" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerModelId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "costPerRequest" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderUsageLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "appId" TEXT,
    "providerId" TEXT NOT NULL,
    "providerModelId" TEXT NOT NULL,
    "providerTaskId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "success" BOOLEAN NOT NULL,
    "costCharged" DECIMAL(10,6),
    "latencyMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "aiModelId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "inputPayload" JSONB NOT NULL,
    "tokenCost" INTEGER NOT NULL,
    "tokensCharged" BOOLEAN NOT NULL DEFAULT false,
    "tokensRefunded" BOOLEAN NOT NULL DEFAULT false,
    "providerTaskId" TEXT,
    "usedProvider" TEXT,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "outputs" JSONB,
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "webhookDelivered" BOOLEAN NOT NULL DEFAULT false,
    "webhookAttempts" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_email_idx" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "App_slug_key" ON "App"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "App_apiKey_key" ON "App"("apiKey");

-- CreateIndex
CREATE INDEX "App_apiKey_idx" ON "App"("apiKey");

-- CreateIndex
CREATE INDEX "App_slug_idx" ON "App"("slug");

-- CreateIndex
CREATE INDEX "AppUser_appId_idx" ON "AppUser"("appId");

-- CreateIndex
CREATE INDEX "AppUser_externalId_idx" ON "AppUser"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_appId_externalId_key" ON "AppUser"("appId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenLedgerEntry_idempotencyKey_key" ON "TokenLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TokenLedgerEntry_appUserId_idx" ON "TokenLedgerEntry"("appUserId");

-- CreateIndex
CREATE INDEX "TokenLedgerEntry_jobId_idx" ON "TokenLedgerEntry"("jobId");

-- CreateIndex
CREATE INDEX "TokenLedgerEntry_idempotencyKey_idx" ON "TokenLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TokenLedgerEntry_createdAt_idx" ON "TokenLedgerEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIProvider_name_key" ON "AIProvider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AIModel_name_key" ON "AIModel"("name");

-- CreateIndex
CREATE INDEX "ModelProviderConfig_modelId_priority_idx" ON "ModelProviderConfig"("modelId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ModelProviderConfig_modelId_providerId_key" ON "ModelProviderConfig"("modelId", "providerId");

-- CreateIndex
CREATE INDEX "ProviderUsageLog_providerId_idx" ON "ProviderUsageLog"("providerId");

-- CreateIndex
CREATE INDEX "ProviderUsageLog_appId_idx" ON "ProviderUsageLog"("appId");

-- CreateIndex
CREATE INDEX "ProviderUsageLog_jobId_idx" ON "ProviderUsageLog"("jobId");

-- CreateIndex
CREATE INDEX "ProviderUsageLog_createdAt_idx" ON "ProviderUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "GenerationJob_appId_status_idx" ON "GenerationJob"("appId", "status");

-- CreateIndex
CREATE INDEX "GenerationJob_appUserId_idx" ON "GenerationJob"("appUserId");

-- CreateIndex
CREATE INDEX "GenerationJob_aiModelId_idx" ON "GenerationJob"("aiModelId");

-- CreateIndex
CREATE INDEX "GenerationJob_status_priority_idx" ON "GenerationJob"("status", "priority");

-- CreateIndex
CREATE INDEX "GenerationJob_providerTaskId_idx" ON "GenerationJob"("providerTaskId");

-- CreateIndex
CREATE INDEX "GenerationJob_createdAt_idx" ON "GenerationJob"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppUser" ADD CONSTRAINT "AppUser_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenLedgerEntry" ADD CONSTRAINT "TokenLedgerEntry_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelProviderConfig" ADD CONSTRAINT "ModelProviderConfig_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AIModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelProviderConfig" ADD CONSTRAINT "ModelProviderConfig_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AIProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderUsageLog" ADD CONSTRAINT "ProviderUsageLog_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AIProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderUsageLog" ADD CONSTRAINT "ProviderUsageLog_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AIModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
