-- Support tickets table
CREATE TABLE "SupportTicket" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT,
  "userName"    TEXT NOT NULL,
  "userEmail"   TEXT NOT NULL,
  "subject"     TEXT NOT NULL,
  "category"    TEXT NOT NULL,
  "message"     TEXT NOT NULL,
  "priority"    TEXT NOT NULL DEFAULT 'normal',
  "status"      TEXT NOT NULL DEFAULT 'open',
  "adminReply"  TEXT,
  "repliedById" TEXT,
  "repliedAt"   TIMESTAMP(3),
  "closedAt"    TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");
CREATE INDEX "SupportTicket_userId_idx" ON "SupportTicket"("userId");

-- Foreign key to User
ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;