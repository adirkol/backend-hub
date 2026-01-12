-- Add missing columns to RevenueCatEvent table
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "store" TEXT;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "tokenAmount" INTEGER;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "tokenCurrencyCode" TEXT;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "priceUsd" DECIMAL(10, 2);
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "taxPercentage" DECIMAL(5, 4);
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "commissionPercentage" DECIMAL(5, 4);
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "netRevenueUsd" DECIMAL(10, 2);
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "renewalNumber" INTEGER;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "isTrialConversion" BOOLEAN;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "offerCode" TEXT;
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;

-- Make environment column nullable (some events may not have it)
ALTER TABLE "RevenueCatEvent" ALTER COLUMN "environment" DROP NOT NULL;

-- Add createdAt column if missing (some tables have it, some don't)
ALTER TABLE "RevenueCatEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
