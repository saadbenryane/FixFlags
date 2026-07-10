-- Create ShareLink model for agency plan sharing
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "password" TEXT,
    "expiresAt" TIMESTAMP(3),
    "maxViews" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");
CREATE INDEX "share_links_auditId_idx" ON "share_links"("auditId");

ALTER TABLE "share_links" ADD CONSTRAINT "share_links_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
