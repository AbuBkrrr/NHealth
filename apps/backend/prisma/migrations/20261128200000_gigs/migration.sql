-- CreateTable
CREATE TABLE "Gig" (
    "id" TEXT NOT NULL,
    "posterId" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "orgType" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "specialty" TEXT,
    "positions" INTEGER NOT NULL DEFAULT 1,
    "experience" TEXT NOT NULL DEFAULT 'ANY',
    "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
    "shifts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hoursPerWeek" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "payMin" DECIMAL(12,2),
    "payMax" DECIMAL(12,2),
    "payPeriod" TEXT NOT NULL DEFAULT 'MONTH',
    "payNegotiable" BOOLEAN NOT NULL DEFAULT false,
    "licenseRequired" BOOLEAN NOT NULL DEFAULT true,
    "qualifications" TEXT,
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "reports" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GigApplication" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "coverNote" TEXT,
    "expectedPay" DECIMAL(12,2),
    "availableFrom" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "employerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GigApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profession" TEXT NOT NULL,
    "specialty" TEXT,
    "licenseBody" TEXT,
    "licenseNumber" TEXT,
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "skills" TEXT,
    "summary" TEXT,
    "cvUrl" TEXT,
    "cvFileId" TEXT,
    "employmentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "states" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedPay" DECIMAL(12,2),
    "payPeriod" TEXT NOT NULL DEFAULT 'MONTH',
    "openToWork" BOOLEAN NOT NULL DEFAULT true,
    "alerts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Gig_status_profession_state_idx" ON "Gig"("status", "profession", "state");

-- CreateIndex
CREATE INDEX "Gig_posterId_idx" ON "Gig"("posterId");

-- CreateIndex
CREATE INDEX "GigApplication_applicantId_idx" ON "GigApplication"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "GigApplication_gigId_applicantId_key" ON "GigApplication"("gigId", "applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkProfile_userId_key" ON "WorkProfile"("userId");

-- CreateIndex
CREATE INDEX "WorkProfile_profession_openToWork_idx" ON "WorkProfile"("profession", "openToWork");

-- AddForeignKey
ALTER TABLE "GigApplication" ADD CONSTRAINT "GigApplication_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

