CREATE TABLE "audit_pipeline_events" (
  "id" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "traceId" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL,
  "stage" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "durationMs" INTEGER,
  "detail" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_pipeline_events_pkey" PRIMARY KEY ("id")
);

INSERT INTO "audit_pipeline_events" (
  "id", "auditId", "executionId", "traceId", "attempt", "stage", "event",
  "status", "durationMs", "detail", "occurredAt"
)
SELECT
  'legacy_' || md5(a."id" || ':' || entry.ordinality::text),
  a."id",
  a."id" || ':legacy',
  a."id",
  0,
  entry.value->>'stage',
  entry.value->>'event',
  CASE
    WHEN entry.value->>'event' LIKE '%failed%' THEN 'failed'
    WHEN entry.value->>'event' LIKE '%skipped%' THEN 'skipped'
    WHEN entry.value->>'event' LIKE '%started%' THEN 'started'
    WHEN entry.value->>'event' LIKE '%partial%' OR entry.value->>'event' LIKE '%degraded%' THEN 'partial'
    ELSE 'completed'
  END,
  CASE
    WHEN jsonb_typeof(entry.value->'durationMs') = 'number'
    THEN (entry.value->>'durationMs')::integer
    ELSE NULL
  END,
  jsonb_strip_nulls(jsonb_build_object(
    'error', entry.value->'error',
    'detail', entry.value->'detail'
  )),
  COALESCE((entry.value->>'ts')::timestamp, a."createdAt")
FROM "audits" a
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(a."pipelineLog") = 'array' THEN a."pipelineLog"
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS entry(value, ordinality)
WHERE
  entry.value ? 'stage'
  AND entry.value ? 'event'
  AND entry.value ? 'ts';

CREATE INDEX "audit_pipeline_events_auditId_attempt_occurredAt_idx"
ON "audit_pipeline_events"("auditId", "attempt", "occurredAt");

CREATE INDEX "audit_pipeline_events_traceId_occurredAt_idx"
ON "audit_pipeline_events"("traceId", "occurredAt");

ALTER TABLE "audit_pipeline_events"
ADD CONSTRAINT "audit_pipeline_events_auditId_fkey"
FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audits" DROP COLUMN "pipelineLog";
