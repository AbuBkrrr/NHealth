-- N-Health Credits ledger
CREATE TABLE "CreditLedger" (
  "id"                TEXT NOT NULL,
  "userId"            TEXT NOT NULL,
  "balance"           DECIMAL(12,2) NOT NULL DEFAULT 0,
  "lastTransactionId" TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreditLedger_userId_key" ON "CreditLedger"("userId");
CREATE INDEX "CreditLedger_userId_idx" ON "CreditLedger"("userId");
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Credit transactions
CREATE TABLE "CreditTransaction" (
  "id"           TEXT NOT NULL,
  "ledgerId"     TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "type"         TEXT NOT NULL,
  "amount"       DECIMAL(12,2) NOT NULL,
  "balanceAfter" DECIMAL(12,2) NOT NULL,
  "description"  TEXT NOT NULL,
  "reference"    TEXT NOT NULL,
  "metadata"     JSONB,
  "status"       TEXT NOT NULL DEFAULT 'completed',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreditTransaction_reference_key" ON "CreditTransaction"("reference");
CREATE INDEX "CreditTransaction_userId_idx" ON "CreditTransaction"("userId");
CREATE INDEX "CreditTransaction_ledgerId_idx" ON "CreditTransaction"("ledgerId");
CREATE INDEX "CreditTransaction_type_idx" ON "CreditTransaction"("type");
CREATE INDEX "CreditTransaction_reference_idx" ON "CreditTransaction"("reference");
CREATE INDEX "CreditTransaction_createdAt_idx" ON "CreditTransaction"("createdAt");
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_ledgerId_fkey"
  FOREIGN KEY ("ledgerId") REFERENCES "CreditLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Payment gateway logs
CREATE TABLE "PaymentGatewayLog" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT,
  "gateway"         TEXT NOT NULL,
  "gatewayRef"      TEXT NOT NULL,
  "internalRef"     TEXT NOT NULL,
  "amount"          DECIMAL(12,2) NOT NULL,
  "currency"        TEXT NOT NULL DEFAULT 'NGN',
  "status"          TEXT NOT NULL,
  "purpose"         TEXT NOT NULL,
  "requestPayload"  JSONB,
  "responsePayload" JSONB,
  "webhookPayload"  JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentGatewayLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentGatewayLog_internalRef_key" ON "PaymentGatewayLog"("internalRef");
CREATE INDEX "PaymentGatewayLog_userId_idx" ON "PaymentGatewayLog"("userId");
CREATE INDEX "PaymentGatewayLog_gateway_idx" ON "PaymentGatewayLog"("gateway");
CREATE INDEX "PaymentGatewayLog_status_idx" ON "PaymentGatewayLog"("status");
CREATE INDEX "PaymentGatewayLog_internalRef_idx" ON "PaymentGatewayLog"("internalRef");
CREATE INDEX "PaymentGatewayLog_gatewayRef_idx" ON "PaymentGatewayLog"("gatewayRef");
ALTER TABLE "PaymentGatewayLog" ADD CONSTRAINT "PaymentGatewayLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Escrow transactions
CREATE TABLE "EscrowTransaction" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "payscrowRef" TEXT NOT NULL,
  "amount"      DECIMAL(12,2) NOT NULL,
  "fee"         DECIMAL(12,2) NOT NULL,
  "purpose"     TEXT NOT NULL,
  "purposeId"   TEXT NOT NULL,
  "status"      TEXT NOT NULL,
  "fundedAt"    TIMESTAMP(3),
  "releasedAt"  TIMESTAMP(3),
  "disputedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EscrowTransaction_payscrowRef_key" ON "EscrowTransaction"("payscrowRef");
CREATE INDEX "EscrowTransaction_userId_idx" ON "EscrowTransaction"("userId");
CREATE INDEX "EscrowTransaction_status_idx" ON "EscrowTransaction"("status");
CREATE INDEX "EscrowTransaction_purposeId_idx" ON "EscrowTransaction"("purposeId");
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;