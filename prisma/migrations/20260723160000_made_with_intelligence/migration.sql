-- CreateEnum
CREATE TYPE "TechnologyDetectionStatus" AS ENUM ('NOT_CAPTURED', 'COMPLETE', 'PARTIAL', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "audits"
ADD COLUMN "technologyDetectionStatus" "TechnologyDetectionStatus" NOT NULL DEFAULT 'NOT_CAPTURED',
ADD COLUMN "technologyDetectorVersion" TEXT,
ADD COLUMN "technologyDetectedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "graph_site_technology"
ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "graph_site_technology_siteId_isCurrent_idx"
ON "graph_site_technology"("siteId", "isCurrent");

-- CreateTable
CREATE TABLE "audit_technology_observation" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "technologyId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidence" JSONB NOT NULL,
    "detectorVersion" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_technology_observation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_technology_observation_auditId_technologyId_key"
ON "audit_technology_observation"("auditId", "technologyId");

-- CreateIndex
CREATE INDEX "audit_technology_observation_auditId_idx"
ON "audit_technology_observation"("auditId");

-- CreateIndex
CREATE INDEX "audit_technology_observation_technologyId_idx"
ON "audit_technology_observation"("technologyId");

-- AddForeignKey
ALTER TABLE "audit_technology_observation"
ADD CONSTRAINT "audit_technology_observation_auditId_fkey"
FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_technology_observation"
ADD CONSTRAINT "audit_technology_observation_technologyId_fkey"
FOREIGN KEY ("technologyId") REFERENCES "graph_technology"("id") ON DELETE CASCADE ON UPDATE CASCADE;
