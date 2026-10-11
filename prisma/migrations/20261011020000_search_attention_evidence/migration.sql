-- Classification is a versioned decision, independent of finding identity and severity.
ALTER TABLE "flags" ADD COLUMN "attentionPolicy" JSONB;
