-- CreateTable
CREATE TABLE "MarketingLink" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'other',
    "campaign" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "landing" TEXT NOT NULL DEFAULT 'pitch',
    "country" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingVisit" (
    "id" TEXT NOT NULL,
    "linkId" TEXT,
    "deviceKey" TEXT NOT NULL,
    "idSource" TEXT NOT NULL DEFAULT 'id',
    "deviceNo" INTEGER NOT NULL DEFAULT 1,
    "openNo" INTEGER NOT NULL DEFAULT 1,
    "ipHash" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "timezone" TEXT,
    "language" TEXT,
    "deviceType" TEXT,
    "os" TEXT,
    "browser" TEXT,
    "model" TEXT,
    "inApp" TEXT,
    "screen" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingLead" (
    "id" TEXT NOT NULL,
    "linkId" TEXT,
    "deviceKey" TEXT,
    "opensBefore" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "interest" TEXT NOT NULL DEFAULT 'PATIENT',
    "organization" TEXT,
    "country" TEXT,
    "city" TEXT,
    "message" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "userId" TEXT,
    "unsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingConversion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkId" TEXT,
    "deviceKey" TEXT,
    "role" TEXT NOT NULL,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingBroadcast" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "audience" JSONB NOT NULL,
    "linkId" TEXT,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingLink_slug_key" ON "MarketingLink"("slug");

-- CreateIndex
CREATE INDEX "MarketingLink_campaign_idx" ON "MarketingLink"("campaign");

-- CreateIndex
CREATE INDEX "MarketingVisit_linkId_createdAt_idx" ON "MarketingVisit"("linkId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketingVisit_deviceKey_idx" ON "MarketingVisit"("deviceKey");

-- CreateIndex
CREATE INDEX "MarketingVisit_createdAt_idx" ON "MarketingVisit"("createdAt");

-- CreateIndex
CREATE INDEX "MarketingLead_createdAt_idx" ON "MarketingLead"("createdAt");

-- CreateIndex
CREATE INDEX "MarketingLead_email_idx" ON "MarketingLead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingConversion_userId_key" ON "MarketingConversion"("userId");

-- CreateIndex
CREATE INDEX "MarketingConversion_linkId_idx" ON "MarketingConversion"("linkId");

-- AddForeignKey
ALTER TABLE "MarketingVisit" ADD CONSTRAINT "MarketingVisit_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MarketingLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingLead" ADD CONSTRAINT "MarketingLead_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MarketingLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

