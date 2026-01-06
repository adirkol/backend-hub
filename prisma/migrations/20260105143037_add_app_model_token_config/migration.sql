-- CreateTable
CREATE TABLE "AppModelTokenConfig" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "tokenCost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppModelTokenConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppModelTokenConfig_appId_idx" ON "AppModelTokenConfig"("appId");

-- CreateIndex
CREATE INDEX "AppModelTokenConfig_modelId_idx" ON "AppModelTokenConfig"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "AppModelTokenConfig_appId_modelId_key" ON "AppModelTokenConfig"("appId", "modelId");

-- AddForeignKey
ALTER TABLE "AppModelTokenConfig" ADD CONSTRAINT "AppModelTokenConfig_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppModelTokenConfig" ADD CONSTRAINT "AppModelTokenConfig_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AIModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
