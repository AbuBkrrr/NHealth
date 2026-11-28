-- Coins offered towards another person's care (never transferred to their balance)
CREATE TABLE "CoinSponsorship" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFERED',
    "payableType" TEXT,
    "payableId" TEXT,
    "usedCoins" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinSponsorship_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CoinSponsorship_reference_key" ON "CoinSponsorship"("reference");
CREATE INDEX "CoinSponsorship_fromUserId_createdAt_idx" ON "CoinSponsorship"("fromUserId", "createdAt");
CREATE INDEX "CoinSponsorship_toUserId_status_idx" ON "CoinSponsorship"("toUserId", "status");
ALTER TABLE "CoinRedemption" ADD COLUMN "sponsorshipId" TEXT;
