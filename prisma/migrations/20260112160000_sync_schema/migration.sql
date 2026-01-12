-- Comprehensive schema sync migration
-- Fixes all differences between production and schema.prisma

-- ============================================
-- Fix EventCategory enum (VIRTUAL_CURRENCY,SUBSCRIPTION,PURCHASE,OTHER -> TOKEN,REVENUE)
-- ============================================

-- First, update existing data to use new values
UPDATE "RevenueCatEvent" SET "eventCategory" = 'VIRTUAL_CURRENCY' WHERE "eventCategory"::text = 'TOKEN';
-- Handle the rename by creating new enum and migrating

-- Create new enum type
DO $$ BEGIN
    CREATE TYPE "EventCategory_new" AS ENUM ('TOKEN', 'REVENUE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update the column to text temporarily, then to new enum
ALTER TABLE "RevenueCatEvent" 
    ALTER COLUMN "eventCategory" TYPE TEXT USING (
        CASE "eventCategory"::text
            WHEN 'VIRTUAL_CURRENCY' THEN 'TOKEN'
            WHEN 'SUBSCRIPTION' THEN 'REVENUE'
            WHEN 'PURCHASE' THEN 'REVENUE'
            WHEN 'OTHER' THEN 'REVENUE'
            WHEN 'TOKEN' THEN 'TOKEN'
            WHEN 'REVENUE' THEN 'REVENUE'
            ELSE 'REVENUE'
        END
    );

ALTER TABLE "RevenueCatEvent" 
    ALTER COLUMN "eventCategory" TYPE "EventCategory_new" USING "eventCategory"::"EventCategory_new";

-- Drop old enum and rename new
DROP TYPE IF EXISTS "EventCategory_old";
ALTER TYPE "EventCategory" RENAME TO "EventCategory_old";
ALTER TYPE "EventCategory_new" RENAME TO "EventCategory";
DROP TYPE IF EXISTS "EventCategory_old";

-- ============================================
-- Fix RevenueCatEventType enum (remove SUBSCRIBER_ALIAS if exists)
-- ============================================

-- Create the corrected enum
DO $$ BEGIN
    CREATE TYPE "RevenueCatEventType_new" AS ENUM (
        'VIRTUAL_CURRENCY_TRANSACTION',
        'INITIAL_PURCHASE',
        'RENEWAL',
        'NON_RENEWING_PURCHASE',
        'CANCELLATION',
        'EXPIRATION',
        'BILLING_ISSUE',
        'PRODUCT_CHANGE',
        'UNCANCELLATION',
        'SUBSCRIPTION_PAUSED',
        'SUBSCRIPTION_EXTENDED',
        'TRANSFER',
        'TEST'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Convert column (will fail if there are SUBSCRIBER_ALIAS values)
ALTER TABLE "RevenueCatEvent" 
    ALTER COLUMN "eventType" TYPE "RevenueCatEventType_new" USING "eventType"::text::"RevenueCatEventType_new";

DROP TYPE IF EXISTS "RevenueCatEventType_old";
ALTER TYPE "RevenueCatEventType" RENAME TO "RevenueCatEventType_old";
ALTER TYPE "RevenueCatEventType_new" RENAME TO "RevenueCatEventType";
DROP TYPE IF EXISTS "RevenueCatEventType_old";

-- ============================================
-- Remove extra columns not in schema
-- ============================================

ALTER TABLE "RevenueCatEvent" DROP COLUMN IF EXISTS "entitlementIds";
ALTER TABLE "RevenueCatEvent" DROP COLUMN IF EXISTS "periodType";
ALTER TABLE "RevenueCatEvent" DROP COLUMN IF EXISTS "presentedOfferingId";
ALTER TABLE "RevenueCatEvent" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "RevenueCatEvent" DROP COLUMN IF EXISTS "price";
ALTER TABLE "RevenueCatEvent" DROP COLUMN IF EXISTS "priceInPurchasedCurrency";
ALTER TABLE "RevenueCatEvent" DROP COLUMN IF EXISTS "virtualCurrencyAmount";
ALTER TABLE "RevenueCatEvent" DROP COLUMN IF EXISTS "cancellationReason";
ALTER TABLE "RevenueCatEvent" DROP COLUMN IF EXISTS "expirationReason";
ALTER TABLE "RevenueCatEvent" DROP COLUMN IF EXISTS "processedAt";

-- ============================================
-- Fix column defaults and constraints
-- ============================================

-- Make environment NOT NULL with default
UPDATE "RevenueCatEvent" SET "environment" = 'PRODUCTION' WHERE "environment" IS NULL;
ALTER TABLE "RevenueCatEvent" ALTER COLUMN "environment" SET NOT NULL;
ALTER TABLE "RevenueCatEvent" ALTER COLUMN "environment" SET DEFAULT 'PRODUCTION';

-- Fix processed default to true
ALTER TABLE "RevenueCatEvent" ALTER COLUMN "processed" SET DEFAULT true;

-- ============================================
-- Fix foreign key for appUser (should be SET NULL on delete)
-- ============================================

-- Drop existing constraint if exists and recreate with correct behavior
ALTER TABLE "RevenueCatEvent" DROP CONSTRAINT IF EXISTS "RevenueCatEvent_appUserId_fkey";
ALTER TABLE "RevenueCatEvent" 
    ADD CONSTRAINT "RevenueCatEvent_appUserId_fkey" 
    FOREIGN KEY ("appUserId") 
    REFERENCES "AppUser"("id") 
    ON DELETE SET NULL 
    ON UPDATE CASCADE;
