-- BankAccount model
CREATE TABLE "BankAccount" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "bankCode"      TEXT NOT NULL,
  "bankName"      TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "accountName"   TEXT NOT NULL,
  "isPrimary"     BOOLEAN NOT NULL DEFAULT true,
  "isVerified"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BankAccount_userId_accountNumber_key" ON "BankAccount"("userId", "accountNumber");
CREATE INDEX "BankAccount_userId_idx" ON "BankAccount"("userId");
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extend EscrowTransaction with PayScrow fields
ALTER TABLE "EscrowTransaction" ADD COLUMN "providerUserId" TEXT;
ALTER TABLE "EscrowTransaction" ADD COLUMN "externalReference" TEXT;
ALTER TABLE "EscrowTransaction" ADD COLUMN "payscrowTransactionId" TEXT;
ALTER TABLE "EscrowTransaction" ADD COLUMN "paymentLink" TEXT;
ALTER TABLE "EscrowTransaction" ADD COLUMN "escrowCode" TEXT;
ALTER TABLE "EscrowTransaction" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN';
ALTER TABLE "EscrowTransaction" ADD COLUMN "merchantCharge" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "EscrowTransaction" ADD COLUMN "customerCharge" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "EscrowTransaction" ADD COLUMN "totalPayable" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "EscrowTransaction" ADD COLUMN "netSettlement" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "EscrowTransaction" ADD COLUMN "terminatedAt" TIMESTAMP(3);
ALTER TABLE "EscrowTransaction" ADD COLUMN "metadata" JSONB;

CREATE UNIQUE INDEX "EscrowTransaction_externalReference_key" ON "EscrowTransaction"("externalReference");
CREATE INDEX "EscrowTransaction_providerUserId_idx" ON "EscrowTransaction"("providerUserId");
CREATE INDEX "EscrowTransaction_payscrowRef_idx" ON "EscrowTransaction"("payscrowRef");
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_providerUserId_fkey"
  FOREIGN KEY ("providerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;