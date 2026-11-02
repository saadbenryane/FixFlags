-- Historical attempts retain their original single-source contract.
ALTER TABLE "improvement_attempts" ADD COLUMN "sourceFlagIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
