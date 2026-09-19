-- Add health-related fields to PatientProfile
ALTER TABLE "PatientProfile" ADD COLUMN "height" DOUBLE PRECISION;
ALTER TABLE "PatientProfile" ADD COLUMN "weight" DOUBLE PRECISION;
ALTER TABLE "PatientProfile" ADD COLUMN "bloodTypeChanges" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PatientProfile" ADD COLUMN "genotypeChanges" INTEGER NOT NULL DEFAULT 0;
