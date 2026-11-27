-- Visits to a provider's public page (flyer QR scans)
CREATE TABLE "ProviderPageVisit" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "deviceKey" TEXT,
    "source" TEXT NOT NULL DEFAULT 'link',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderPageVisit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProviderPageVisit_providerId_createdAt_idx" ON "ProviderPageVisit"("providerId", "createdAt");
