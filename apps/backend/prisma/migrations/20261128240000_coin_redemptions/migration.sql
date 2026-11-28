-- Reward coins applied to part of a bill
CREATE TABLE "CoinRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payableType" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "coins" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoinRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CoinRedemption_reference_key" ON "CoinRedemption"("reference");
CREATE UNIQUE INDEX "CoinRedemption_payableType_payableId_key" ON "CoinRedemption"("payableType", "payableId");
CREATE INDEX "CoinRedemption_userId_idx" ON "CoinRedemption"("userId");
