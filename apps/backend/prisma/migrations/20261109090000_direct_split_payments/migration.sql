-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "flutterwaveSubaccount" TEXT,
ADD COLUMN     "paystackSubaccount" TEXT;

-- AlterTable
ALTER TABLE "InstitutionProfile" ADD COLUMN     "staffSharePercent" INTEGER NOT NULL DEFAULT 100;

