-- Emergency board on institutions + patients going to a hospital emergency unit themselves
ALTER TABLE "InstitutionProfile" ADD COLUMN "erOpen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "InstitutionProfile" ADD COLUMN "erDoctorsOnDuty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InstitutionProfile" ADD COLUMN "erNursesOnDuty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InstitutionProfile" ADD COLUMN "erServices" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "InstitutionProfile" ADD COLUMN "erUpdatedAt" TIMESTAMP(3);

CREATE TABLE "ErArrival" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MEDICAL',
    "notes" TEXT,
    "transport" TEXT NOT NULL DEFAULT 'CAR',
    "forSomeoneElse" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "locatedAt" TIMESTAMP(3),
    "etaMinutes" INTEGER,
    "readyNote" TEXT,
    "declineReason" TEXT,
    "respondedBy" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "ErArrival_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ErArrival_patientId_createdAt_idx" ON "ErArrival"("patientId", "createdAt");
CREATE INDEX "ErArrival_institutionId_status_idx" ON "ErArrival"("institutionId", "status");
ALTER TABLE "ErArrival" ADD CONSTRAINT "ErArrival_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ErArrival" ADD CONSTRAINT "ErArrival_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "InstitutionProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
