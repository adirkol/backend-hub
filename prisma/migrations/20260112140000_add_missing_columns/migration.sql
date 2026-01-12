-- Add missing columns to App table
ALTER TABLE "App" ADD COLUMN IF NOT EXISTS "tokenExpirationDays" INTEGER;
ALTER TABLE "App" ADD COLUMN IF NOT EXISTS "appStoreUrl" TEXT;
ALTER TABLE "App" ADD COLUMN IF NOT EXISTS "bundleId" TEXT;
ALTER TABLE "App" ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;
ALTER TABLE "App" ADD COLUMN IF NOT EXISTS "revenueCatAppId" TEXT;

-- Add index and unique constraint for revenueCatAppId
CREATE UNIQUE INDEX IF NOT EXISTS "App_revenueCatAppId_key" ON "App"("revenueCatAppId");
CREATE INDEX IF NOT EXISTS "App_revenueCatAppId_idx" ON "App"("revenueCatAppId");

-- Add missing column to AppUser table
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "needsTokenSync" BOOLEAN NOT NULL DEFAULT false;

-- Add missing column to TokenLedgerEntry table
ALTER TABLE "TokenLedgerEntry" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "TokenLedgerEntry_expiresAt_idx" ON "TokenLedgerEntry"("expiresAt");

-- Add missing enum values to TokenEntryType
ALTER TYPE "TokenEntryType" ADD VALUE IF NOT EXISTS 'REVENUECAT_GRANT';
ALTER TYPE "TokenEntryType" ADD VALUE IF NOT EXISTS 'REVENUECAT_REFUND';

-- Create RevenueCat event types
DO $$ BEGIN
    CREATE TYPE "RevenueCatEventType" AS ENUM (
        'INITIAL_PURCHASE',
        'RENEWAL',
        'CANCELLATION',
        'UNCANCELLATION',
        'NON_RENEWING_PURCHASE',
        'SUBSCRIPTION_PAUSED',
        'EXPIRATION',
        'BILLING_ISSUE',
        'PRODUCT_CHANGE',
        'TRANSFER',
        'SUBSCRIBER_ALIAS',
        'SUBSCRIPTION_EXTENDED',
        'VIRTUAL_CURRENCY_TRANSACTION',
        'TEST'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "EventCategory" AS ENUM (
        'VIRTUAL_CURRENCY',
        'SUBSCRIPTION',
        'PURCHASE',
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create RevenueCatEvent table
CREATE TABLE IF NOT EXISTS "RevenueCatEvent" (
    "id" TEXT NOT NULL,
    "revenueCatEventId" TEXT NOT NULL,
    "eventType" "RevenueCatEventType" NOT NULL,
    "eventCategory" "EventCategory" NOT NULL,
    "eventTimestampMs" BIGINT NOT NULL,
    "revenueCatUserId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "appUserId" TEXT,
    "productId" TEXT,
    "entitlementIds" TEXT[],
    "periodType" TEXT,
    "purchasedAtMs" BIGINT,
    "expirationAtMs" BIGINT,
    "environment" TEXT,
    "presentedOfferingId" TEXT,
    "transactionId" TEXT,
    "originalTransactionId" TEXT,
    "currency" TEXT,
    "price" DOUBLE PRECISION,
    "priceInPurchasedCurrency" DOUBLE PRECISION,
    "virtualCurrencyAmount" INTEGER,
    "cancellationReason" TEXT,
    "expirationReason" TEXT,
    "rawPayload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueCatEvent_pkey" PRIMARY KEY ("id")
);

-- Create indexes for RevenueCatEvent
CREATE UNIQUE INDEX IF NOT EXISTS "RevenueCatEvent_revenueCatEventId_key" ON "RevenueCatEvent"("revenueCatEventId");
CREATE INDEX IF NOT EXISTS "RevenueCatEvent_appId_idx" ON "RevenueCatEvent"("appId");
CREATE INDEX IF NOT EXISTS "RevenueCatEvent_appUserId_idx" ON "RevenueCatEvent"("appUserId");
CREATE INDEX IF NOT EXISTS "RevenueCatEvent_eventType_idx" ON "RevenueCatEvent"("eventType");
CREATE INDEX IF NOT EXISTS "RevenueCatEvent_eventCategory_idx" ON "RevenueCatEvent"("eventCategory");
CREATE INDEX IF NOT EXISTS "RevenueCatEvent_revenueCatUserId_idx" ON "RevenueCatEvent"("revenueCatUserId");
CREATE INDEX IF NOT EXISTS "RevenueCatEvent_eventTimestampMs_idx" ON "RevenueCatEvent"("eventTimestampMs");
CREATE INDEX IF NOT EXISTS "RevenueCatEvent_createdAt_idx" ON "RevenueCatEvent"("createdAt");

-- Add foreign keys for RevenueCatEvent
ALTER TABLE "RevenueCatEvent" ADD CONSTRAINT "RevenueCatEvent_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueCatEvent" ADD CONSTRAINT "RevenueCatEvent_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
