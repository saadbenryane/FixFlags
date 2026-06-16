-- FixFlags rebrand: collapse 7 areas → 3 rubrics, findings → flags

-- New enums
CREATE TYPE "RubricName" AS ENUM ('MESSAGE', 'EXPERIENCE', 'REACH');
CREATE TYPE "RubricGrade" AS ENUM ('A', 'B', 'C', 'D', 'F');
CREATE TYPE "RubricStatus" AS ENUM ('EXCELLENT', 'GOOD', 'NEEDS_WORK', 'CRITICAL');
CREATE TYPE "ImpactTag" AS ENUM ('CONVERSION', 'REVENUE', 'TRUST', 'MEASUREMENT', 'SHARING', 'SEO', 'ACCESSIBILITY');
CREATE TYPE "FlagSource" AS ENUM ('DETERMINISTIC', 'AI');
CREATE TYPE "FlagStatus" AS ENUM ('OPEN', 'FIXED', 'IGNORED', 'REGRESSED');

-- New severity enum (3-tier)
CREATE TYPE "Severity_new" AS ENUM ('CRITICAL', 'IMPORTANT', 'POLISH');

-- report_rubrics table
CREATE TABLE "report_rubrics" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "name" "RubricName" NOT NULL,
    "score" INTEGER,
    "grade" "RubricGrade",
    "status" "RubricStatus",
    "assessmentState" "AssessmentState" NOT NULL DEFAULT 'UNKNOWN',
    "confidence" DOUBLE PRECISION,
    "summary" TEXT NOT NULL,
    "rubricPrompt" TEXT NOT NULL,
    "cursorPrompt" TEXT,
    "claudePrompt" TEXT,
    "lovablePrompt" TEXT,
    "boltPrompt" TEXT,
    CONSTRAINT "report_rubrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_rubrics_auditId_name_key" ON "report_rubrics"("auditId", "name");
CREATE INDEX "report_rubrics_auditId_idx" ON "report_rubrics"("auditId");

ALTER TABLE "report_rubrics" ADD CONSTRAINT "report_rubrics_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Collapse 7 audit_areas → 3 report_rubrics per audit (worst grade wins)
INSERT INTO "report_rubrics" ("id", "auditId", "name", "score", "grade", "status", "assessmentState", "confidence", "summary", "rubricPrompt", "cursorPrompt", "claudePrompt", "lovablePrompt", "boltPrompt")
SELECT
    grouped."auditId" || '-' || grouped.rubric_name,
    grouped."auditId",
    grouped.rubric_name::"RubricName",
    grouped."score",
    CASE grouped."grade"::text
        WHEN 'A' THEN 'A'::"RubricGrade"
        WHEN 'B' THEN 'B'::"RubricGrade"
        WHEN 'C' THEN 'C'::"RubricGrade"
        WHEN 'D' THEN 'D'::"RubricGrade"
        WHEN 'F' THEN 'F'::"RubricGrade"
        ELSE NULL
    END,
    CASE grouped."status"::text
        WHEN 'EXCELLENT' THEN 'EXCELLENT'::"RubricStatus"
        WHEN 'GOOD' THEN 'GOOD'::"RubricStatus"
        WHEN 'NEEDS_WORK' THEN 'NEEDS_WORK'::"RubricStatus"
        WHEN 'CRITICAL' THEN 'CRITICAL'::"RubricStatus"
        ELSE NULL
    END,
    grouped."assessmentState",
    grouped."confidence",
    grouped."summary",
    grouped."areaPrompt",
    grouped."cursorPrompt",
    grouped."claudePrompt",
    grouped."lovablePrompt",
    grouped."boltPrompt"
FROM (
    SELECT DISTINCT ON (aa."auditId", rubric_map.rubric)
        aa."auditId",
        rubric_map.rubric AS rubric_name,
        aa."score",
        aa."grade",
        aa."status",
        aa."assessmentState",
        aa."confidence",
        aa."summary",
        aa."areaPrompt",
        aa."cursorPrompt",
        aa."claudePrompt",
        aa."lovablePrompt",
        aa."boltPrompt"
    FROM "audit_areas" aa
    JOIN LATERAL (
        SELECT CASE aa."name"::text
            WHEN 'CONTENT' THEN 'MESSAGE'
            WHEN 'CONVERSION' THEN 'MESSAGE'
            WHEN 'TRUST' THEN 'MESSAGE'
            WHEN 'PERFORMANCE' THEN 'EXPERIENCE'
            WHEN 'MOBILE' THEN 'EXPERIENCE'
            WHEN 'ACCESSIBILITY' THEN 'EXPERIENCE'
            WHEN 'SEO' THEN 'REACH'
            ELSE 'EXPERIENCE'
        END AS rubric
    ) rubric_map ON true
    ORDER BY aa."auditId", rubric_map.rubric,
        CASE aa."grade"::text WHEN 'F' THEN 0 WHEN 'D' THEN 1 WHEN 'C' THEN 2 WHEN 'B' THEN 3 WHEN 'A' THEN 4 ELSE 5 END ASC
) grouped;

-- flags table
CREATE TABLE "flags" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "pageId" TEXT,
    "rubricId" TEXT,
    "source" "FlagSource" NOT NULL,
    "rubric" TEXT NOT NULL,
    "impactTag" "ImpactTag",
    "severity" "Severity_new" NOT NULL,
    "problem" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "fix" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "agentPrompt" TEXT,
    "cursorPrompt" TEXT,
    "claudePrompt" TEXT,
    "lovablePrompt" TEXT,
    "boltPrompt" TEXT,
    "verificationRule" TEXT,
    "checkId" TEXT,
    "pageUrl" TEXT,
    "fingerprint" TEXT,
    "position" INTEGER NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedInId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "flags_auditId_idx" ON "flags"("auditId");
CREATE INDEX "flags_auditId_checkId_idx" ON "flags"("auditId", "checkId");
CREATE INDEX "flags_pageId_idx" ON "flags"("pageId");
CREATE INDEX "flags_auditId_fingerprint_idx" ON "flags"("auditId", "fingerprint");

ALTER TABLE "flags" ADD CONSTRAINT "flags_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flags" ADD CONSTRAINT "flags_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "audit_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flags" ADD CONSTRAINT "flags_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "report_rubrics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate findings → flags
INSERT INTO "flags" (
    "id", "auditId", "pageId", "rubricId", "source", "rubric", "impactTag", "severity",
    "problem", "evidence", "whyItMatters", "fix", "confidence",
    "agentPrompt", "cursorPrompt", "claudePrompt", "lovablePrompt", "boltPrompt",
    "verificationRule", "checkId", "pageUrl", "fingerprint", "position", "status", "resolvedInId", "createdAt"
)
SELECT
    f."id",
    f."auditId",
    f."pageId",
    rr."id" AS "rubricId",
    CASE f."source"::text WHEN 'DETERMINISTIC' THEN 'DETERMINISTIC'::"FlagSource" ELSE 'AI'::"FlagSource" END,
    CASE f."area"
        WHEN 'CONTENT' THEN 'MESSAGE'
        WHEN 'CONVERSION' THEN 'MESSAGE'
        WHEN 'TRUST' THEN 'MESSAGE'
        WHEN 'PERFORMANCE' THEN 'EXPERIENCE'
        WHEN 'MOBILE' THEN 'EXPERIENCE'
        WHEN 'ACCESSIBILITY' THEN 'EXPERIENCE'
        WHEN 'SEO' THEN 'REACH'
        ELSE 'EXPERIENCE'
    END,
    CASE f."area"
        WHEN 'CONTENT' THEN 'TRUST'::"ImpactTag"
        WHEN 'CONVERSION' THEN 'CONVERSION'::"ImpactTag"
        WHEN 'TRUST' THEN 'TRUST'::"ImpactTag"
        WHEN 'PERFORMANCE' THEN NULL
        WHEN 'MOBILE' THEN 'ACCESSIBILITY'::"ImpactTag"
        WHEN 'ACCESSIBILITY' THEN 'ACCESSIBILITY'::"ImpactTag"
        WHEN 'SEO' THEN 'SEO'::"ImpactTag"
        ELSE NULL
    END,
    CASE f."severity"::text
        WHEN 'CRITICAL' THEN 'CRITICAL'::"Severity_new"
        WHEN 'HIGH' THEN 'IMPORTANT'::"Severity_new"
        ELSE 'POLISH'::"Severity_new"
    END,
    f."problem", f."evidence", f."whyItMatters", f."fix", f."confidence",
    f."agentPrompt", f."cursorPrompt", f."claudePrompt", f."lovablePrompt", f."boltPrompt",
    f."verificationRule", f."checkId", f."pageUrl", f."fingerprint", f."position",
    CASE f."status"::text
        WHEN 'FIXED' THEN 'FIXED'::"FlagStatus"
        WHEN 'REGRESSED' THEN 'REGRESSED'::"FlagStatus"
        ELSE 'OPEN'::"FlagStatus"
    END,
    f."resolvedInId",
    f."createdAt"
FROM "findings" f
LEFT JOIN "report_rubrics" rr ON rr."auditId" = f."auditId" AND rr."name" = (
    CASE f."area"
        WHEN 'CONTENT' THEN 'MESSAGE'::"RubricName"
        WHEN 'CONVERSION' THEN 'MESSAGE'::"RubricName"
        WHEN 'TRUST' THEN 'MESSAGE'::"RubricName"
        WHEN 'PERFORMANCE' THEN 'EXPERIENCE'::"RubricName"
        WHEN 'MOBILE' THEN 'EXPERIENCE'::"RubricName"
        WHEN 'ACCESSIBILITY' THEN 'EXPERIENCE'::"RubricName"
        WHEN 'SEO' THEN 'REACH'::"RubricName"
        ELSE 'EXPERIENCE'::"RubricName"
    END
);

-- flag_feedback table
CREATE TABLE "flag_feedback" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "userId" TEXT,
    "vote" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flag_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flag_feedback_flagId_userId_key" ON "flag_feedback"("flagId", "userId");
CREATE INDEX "flag_feedback_flagId_idx" ON "flag_feedback"("flagId");

ALTER TABLE "flag_feedback" ADD CONSTRAINT "flag_feedback_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "flag_feedback" ("id", "flagId", "userId", "vote", "comment", "createdAt")
SELECT "id", "findingId", "userId", "vote", "comment", "createdAt"
FROM "finding_feedback";

-- Drop old tables and enums
DROP TABLE "finding_feedback";
DROP TABLE "findings";
DROP TABLE "audit_areas";

DROP TYPE "FindingStatus";
DROP TYPE "FindingSource";
DROP TYPE "Severity";
ALTER TYPE "Severity_new" RENAME TO "Severity";

DROP TYPE "AreaName";
DROP TYPE "AreaGrade";
DROP TYPE "AreaStatus";
