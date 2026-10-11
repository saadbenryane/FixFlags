ALTER TYPE "SiteConnectionStatus" ADD VALUE 'UNAVAILABLE';
ALTER TABLE "site_connections" ADD COLUMN "lastSyncAttemptAt" TIMESTAMP(3);
ALTER TABLE "site_connection_facts" ADD COLUMN "periodStart" TIMESTAMP(3), ADD COLUMN "periodEnd" TIMESTAMP(3);
