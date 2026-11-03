-- Retained grants receive independent identities without changing credentials or facts.
ALTER TABLE "site_connections"
ADD COLUMN "authorizationId" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
