-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CASH';

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "recipientCode" TEXT,
ADD COLUMN     "verifiedName" TEXT;

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ProviderLedgerEntry" (
    "id" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "gross" DECIMAL(12,2),
    "commissionRate" DECIMAL(5,2),
    "payoutId" TEXT,
    "description" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "gateway" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "transferCode" TEXT,
    "bankName" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "failureReason" TEXT,
    "initiatedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderLedgerEntry_providerUserId_createdAt_idx" ON "ProviderLedgerEntry"("providerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderLedgerEntry_payoutId_idx" ON "ProviderLedgerEntry"("payoutId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderLedgerEntry_providerUserId_type_sourceType_sourceId_key" ON "ProviderLedgerEntry"("providerUserId", "type", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_reference_key" ON "Payout"("reference");

-- CreateIndex
CREATE INDEX "Payout_providerUserId_createdAt_idx" ON "Payout"("providerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- AddForeignKey
ALTER TABLE "ProviderLedgerEntry" ADD CONSTRAINT "ProviderLedgerEntry_providerUserId_fkey" FOREIGN KEY ("providerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_providerUserId_fkey" FOREIGN KEY ("providerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

