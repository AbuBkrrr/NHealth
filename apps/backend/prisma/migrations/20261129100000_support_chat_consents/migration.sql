-- Consents recorded at sign-up
ALTER TABLE "User" ADD COLUMN "dataConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "providerTermsAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "providerTermsVersion" TEXT;

-- Live chat on support tickets (help bubble), and replies to enquiries
ALTER TABLE "SupportTicket" ADD COLUMN "guestToken" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'form';
ALTER TABLE "SupportTicket" ADD COLUMN "lastMessageAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "SupportTicket_guestToken_key" ON "SupportTicket"("guestToken");

CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT,
    "leadId" TEXT,
    "authorId" TEXT,
    "fromStaff" BOOLEAN NOT NULL DEFAULT false,
    "channel" TEXT NOT NULL DEFAULT 'chat',
    "body" TEXT NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");
CREATE INDEX "SupportMessage_leadId_createdAt_idx" ON "SupportMessage"("leadId", "createdAt");
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
