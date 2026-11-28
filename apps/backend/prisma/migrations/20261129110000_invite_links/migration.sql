-- Members' invite links are tracked like marketing links
ALTER TABLE "MarketingLink" ADD COLUMN "inviterId" TEXT;
CREATE UNIQUE INDEX "MarketingLink_inviterId_key" ON "MarketingLink"("inviterId");
