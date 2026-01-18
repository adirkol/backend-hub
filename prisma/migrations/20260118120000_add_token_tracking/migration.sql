-- Add token-based pricing fields to ModelProviderConfig
ALTER TABLE "ModelProviderConfig" ADD COLUMN "inputTokenCostPer1M" DECIMAL(10,6);
ALTER TABLE "ModelProviderConfig" ADD COLUMN "outputTokenCostPer1M" DECIMAL(10,6);

-- Add token usage tracking fields to ProviderUsageLog
ALTER TABLE "ProviderUsageLog" ADD COLUMN "inputTokens" INTEGER;
ALTER TABLE "ProviderUsageLog" ADD COLUMN "outputTokens" INTEGER;
ALTER TABLE "ProviderUsageLog" ADD COLUMN "totalTokens" INTEGER;
