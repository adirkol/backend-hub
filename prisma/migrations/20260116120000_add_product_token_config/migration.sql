-- CreateTable
CREATE TABLE "ProductTokenConfig" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tokenAmount" INTEGER NOT NULL,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTokenConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductTokenConfig_appId_idx" ON "ProductTokenConfig"("appId");

-- CreateIndex
CREATE INDEX "ProductTokenConfig_productId_idx" ON "ProductTokenConfig"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTokenConfig_appId_productId_key" ON "ProductTokenConfig"("appId", "productId");

-- AddForeignKey
ALTER TABLE "ProductTokenConfig" ADD CONSTRAINT "ProductTokenConfig_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
