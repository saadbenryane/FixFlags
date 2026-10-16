-- Credential renewal retains authority. Uninstall and replacement fence old work.
ALTER TABLE "shopify_shops" ADD COLUMN "authorizationVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "revenue_paths" ADD COLUMN "lastVerificationRunId" TEXT;
