CREATE TYPE "CanvasStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

CREATE TABLE "report_canvases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceAuditId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CanvasStatus" NOT NULL DEFAULT 'GENERATING',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "report_canvases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "canvas_versions" (
    "id" TEXT NOT NULL,
    "canvasId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "sourceRefs" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "canvas_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "report_canvases_projectId_updatedAt_idx" ON "report_canvases"("projectId", "updatedAt" DESC);
CREATE INDEX "report_canvases_sourceAuditId_idx" ON "report_canvases"("sourceAuditId");
CREATE INDEX "report_canvases_createdById_idx" ON "report_canvases"("createdById");
CREATE UNIQUE INDEX "canvas_versions_canvasId_version_key" ON "canvas_versions"("canvasId", "version");
CREATE INDEX "canvas_versions_createdById_idx" ON "canvas_versions"("createdById");

ALTER TABLE "report_canvases" ADD CONSTRAINT "report_canvases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_canvases" ADD CONSTRAINT "report_canvases_sourceAuditId_fkey" FOREIGN KEY ("sourceAuditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_canvases" ADD CONSTRAINT "report_canvases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "canvas_versions" ADD CONSTRAINT "canvas_versions_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "report_canvases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "canvas_versions" ADD CONSTRAINT "canvas_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
