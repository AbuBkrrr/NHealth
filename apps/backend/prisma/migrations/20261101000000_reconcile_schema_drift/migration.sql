-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('DOCTOR', 'NURSE', 'PHARMACY', 'LAB', 'AMBULANCE');

-- DropIndex
DROP INDEX "User_phone_key";

-- AlterTable
ALTER TABLE "AdminAuditLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AmbulanceProfile" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BankAccount" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CreditLedger" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DoctorProfile" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Donation" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmergencyRequest" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EscrowTransaction" DROP COLUMN "fee",
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "externalReference" SET NOT NULL;

-- AlterTable
ALTER TABLE "InsurancePolicy" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Inventory" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LabProfile" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LabResult" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LabTest" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NurseProfile" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NurseRequest" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PatientProfile" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentGatewayLog" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PharmacyOrder" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PharmacyProfile" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Prescription" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Supplier" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SupportTicket" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Specialization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL,

    CONSTRAINT "Specialization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Specialization_name_key" ON "Specialization"("name");

