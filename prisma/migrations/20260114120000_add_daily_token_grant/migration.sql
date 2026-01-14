-- Add daily token grant fields to App
ALTER TABLE "App" ADD COLUMN IF NOT EXISTS "dailyTokenGrant" INTEGER NOT NULL DEFAULT 0;

-- Add lastDailyGrantAt to AppUser for tracking daily grant timing
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "lastDailyGrantAt" TIMESTAMP(3);
