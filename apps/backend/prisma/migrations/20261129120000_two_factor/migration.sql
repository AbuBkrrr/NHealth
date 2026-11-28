-- Two-step verification (authenticator app or email code) with backup codes
ALTER TABLE "User" ADD COLUMN "twoFactorMethod" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorPending" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorBackupCodes" JSONB;
ALTER TABLE "User" ADD COLUMN "twoFactorEnabledAt" TIMESTAMP(3);
