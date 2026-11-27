-- Directory of Nigerian health facilities (public registries + admin additions), claimable at sign-up
CREATE TABLE "FacilityListing" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "level" TEXT,
    "ownership" TEXT,
    "ownershipType" TEXT,
    "state" TEXT,
    "lga" TEXT,
    "ward" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "functional" TEXT,
    "nhfrCode" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "addedById" TEXT,
    "claimedByUserId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FacilityListing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FacilityListing_claimedByUserId_key" ON "FacilityListing"("claimedByUserId");
CREATE UNIQUE INDEX "FacilityListing_source_sourceId_key" ON "FacilityListing"("source", "sourceId");
CREATE INDEX "FacilityListing_category_state_idx" ON "FacilityListing"("category", "state");
CREATE INDEX "FacilityListing_state_idx" ON "FacilityListing"("state");
CREATE INDEX "FacilityListing_lat_lng_idx" ON "FacilityListing"("lat", "lng");
