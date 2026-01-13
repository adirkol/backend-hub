-- Add new event types to RevenueCatEventType enum
ALTER TYPE "RevenueCatEventType" ADD VALUE IF NOT EXISTS 'INVOICE_ISSUANCE';
ALTER TYPE "RevenueCatEventType" ADD VALUE IF NOT EXISTS 'TEMPORARY_ENTITLEMENT_GRANT';
ALTER TYPE "RevenueCatEventType" ADD VALUE IF NOT EXISTS 'EXPERIMENT_ENROLLMENT';

-- Add new event categories to EventCategory enum
ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'STATUS';
ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'EXPERIMENT';
ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'OTHER';

-- Add subscription status fields to AppUser
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "subscriptionProductId" TEXT;
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "subscriptionStore" TEXT;
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP(3);
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "subscriptionStartedAt" TIMESTAMP(3);
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "lastBillingIssueAt" TIMESTAMP(3);
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "lastRefundAt" TIMESTAMP(3);

-- Add new fields to RevenueCatEvent
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "expirationReason" TEXT;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "isRefund" BOOLEAN;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "newProductId" TEXT;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "transferredFrom" JSONB;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "transferredTo" JSONB;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "experimentId" TEXT;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "experimentVariant" TEXT;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "enrolledAtMs" BIGINT;
