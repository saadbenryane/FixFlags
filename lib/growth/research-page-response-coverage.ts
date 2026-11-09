import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { destinationContext } from '@/lib/audit/checks/destination-evidence'
import { MIN_PUBLIC_RESEARCH_SITES } from '@/lib/graph/public-research'
import { countResearchGroups, researchIndependenceGroups, type ResearchIndependenceSource } from './research-independence'
import { researchPublicTargetMatchesSite } from './research-sources'

export const PAGE_RESPONSE_RESEARCH_CHECKS = ['page-http-error', 'page-redirect-loop'] as const
const checkVersions = Object.fromEntries(PAGE_RESPONSE_RESEARCH_CHECKS.map(id => [id, CHECK_REGISTRY[id].version]))
const MAX_RECEIPTS = 50_000
const collectionTime = z.iso.datetime()
const captureTargets = z.array(z.string().min(1).max(4200)).min(1).max(6)

export function researchHttpTargetsInScope(siteUrl: string, targets: unknown) {
  const parsed = captureTargets.safeParse(targets)
  return parsed.success && parsed.data.every(url => researchPublicTargetMatchesSite(siteUrl, url))
}

/** Corroborate a module receipt against its single completed HTTP dependency. */
export const researchHttpCaptureSql = Prisma.sql`
  WITH candidates AS (
    SELECT collector.id, document.value->>'collectedAt' AS "collectedAt",
      jsonb_build_array(document.value->'finalUrl') || (document.value->'redirects') AS targets
    FROM audit_execution_tasks evaluator
    JOIN audit_execution_tasks collector ON collector."auditId" = evaluator."auditId"
      AND collector."targetKey" = ANY(ARRAY(SELECT 'task:' || key FROM unnest(evaluator."workDependencies") AS dependency(key)))
    CROSS JOIN LATERAL (SELECT collector."workResult" #> '{data,document}' AS value) document
    WHERE evaluator.id = receipt."taskId" AND evaluator."auditId" = receipt."auditId"
      AND evaluator."workKind" = 'check' AND evaluator."workState" = 'COMPLETED'
      AND collector."workKind" = 'http' AND collector."workState" = 'COMPLETED'
      AND evaluator."pageUrl" = receipt."pageUrl" AND collector."pageUrl" = receipt."pageUrl"
      AND collector."workResult"->>'kind' = 'http' AND collector."workResult"->'version' = '1'::jsonb
      AND document.value->>'url' = receipt."pageUrl"
      AND jsonb_typeof(document.value->'collectedAt') = 'string'
      AND document.value->>'collectedAt' = receipt.detail #>> '{execution,collectedAt}'
      AND CASE WHEN jsonb_typeof(document.value->'redirects') = 'array'
        THEN jsonb_array_length(document.value->'redirects') <= 5 ELSE false END
    LIMIT 2
  )
  SELECT * FROM candidates WHERE (SELECT count(*) FROM candidates) = 1
`

/** Count conclusive observations of the audit entry page. A completed module alone is insufficient. */
export async function readResearchPageResponseCoverage(
  tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
  sources: ReadonlyMap<string, ResearchIndependenceSource & { auditUrl: string; siteUrl: string }>,
  observedBy: Date,
  includeReviewFingerprint = false,
) {
  const method = { scope: 'audit-entry-page' as const, checkVersions }
  const sample = new Set([...sources.values()].map(source => source.hostname))
  const groups = researchIndependenceGroups(sources)
  if (sample.size < MIN_PUBLIC_RESEARCH_SITES ||
    new Set(groups.values()).size < MIN_PUBLIC_RESEARCH_SITES) {
    return { coverage: { ...method, status: 'sample-below-minimum' as const, observedSites: null }, receiptDigests: [] }
  }
  const rows = await tx.$queryRaw<Array<{ auditId: string; createdAt: Date; completedAt: Date; collectedAt: string;
    context: string; targets: unknown; digest: string | null }>>`
    SELECT audit.id AS "auditId", audit."createdAt", audit."completedAt",
      receipt.detail #>> '{execution,collectedAt}' AS "collectedAt", assertion.context,
      capture.targets,
      CASE WHEN ${includeReviewFingerprint} THEN encode(sha256(convert_to(
        jsonb_build_array(receipt."auditId", receipt."taskId", receipt."targetKey", receipt."createdAt", receipt.detail,
          capture.id, capture."collectedAt", capture.targets)::text,
        'UTF8')), 'hex') ELSE NULL END AS digest
    FROM audit_verifier_executions receipt
    JOIN audits audit ON audit.id = receipt."auditId"
    CROSS JOIN LATERAL (${researchHttpCaptureSql}) AS capture
    CROSS JOIN LATERAL (
      SELECT min(item.value->>'context') AS context
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(receipt.detail->'assertions') = 'array'
        THEN CASE WHEN jsonb_array_length(receipt.detail->'assertions') <= 300
          THEN receipt.detail->'assertions' ELSE '[]'::jsonb END
        ELSE '[]'::jsonb END) AS item(value)
      WHERE item.value->>'key' = 'page-response'
      HAVING count(*) = 1 AND bool_and(
        item.value->'complete' = 'true'::jsonb
        AND item.value->>'disposition' IS NULL
        AND receipt.detail->'passed' = item.value->'passed'
        AND (item.value->'passed' = 'false'::jsonb OR
          (item.value->'passed' = 'true'::jsonb AND item.value->'pageResponseQualified' = 'true'::jsonb))
      )
    ) AS assertion
    WHERE receipt."auditId" = ANY(${[...sources.keys()]}::text[])
      AND receipt."targetKey" = 'module:page-response'
      AND receipt.source = 'DETERMINISTIC' AND receipt.status = 'COMPLETED'
      AND receipt.detail->>'kind' = 'site-module-check' AND receipt.detail->'version' = '1'::jsonb
      AND receipt.detail->>'module' = 'page-response'
      AND receipt."pageUrl" = audit.url AND receipt.detail->>'pageUrl' = audit.url
      AND receipt.detail->'applicable' = 'true'::jsonb AND receipt.detail->'complete' = 'true'::jsonb
      AND receipt.detail->'failed' IS DISTINCT FROM 'true'::jsonb
      AND receipt.detail #>> '{execution,auditId}' = audit.id
      AND receipt.detail #>> '{execution,taskId}' = receipt."taskId"
      AND receipt.detail #>> '{execution,source}' = 'http'
      AND (receipt.detail #> '{execution,checkVersions}') @> ${JSON.stringify(checkVersions)}::jsonb
      AND receipt."createdAt" BETWEEN audit."createdAt" AND ${observedBy}
    LIMIT ${MAX_RECEIPTS + 1}
  `
  if (rows.length > MAX_RECEIPTS) {
    return { coverage: { ...method, status: 'receipt-limit-exceeded' as const, observedSites: null }, receiptDigests: [] }
  }
  const observed = new Set<string>()
  const observedAudits = new Set<string>()
  const receipts = new Set<string>()
  for (const row of rows) {
    const source = sources.get(row.auditId)
    const collectedAt = collectionTime.safeParse(row.collectedAt)
    if (!source || !collectedAt.success || !researchHttpTargetsInScope(source.siteUrl, row.targets)) continue
    const time = new Date(collectedAt.data)
    if (time >= row.createdAt && time <= row.completedAt && time <= observedBy &&
      row.context === destinationContext(source.auditUrl, source.auditUrl)) {
      observed.add(source.hostname)
      observedAudits.add(row.auditId)
      if (row.digest) receipts.add(row.digest)
    }
  }
  if (observed.size < MIN_PUBLIC_RESEARCH_SITES ||
    countResearchGroups(observedAudits, groups) < MIN_PUBLIC_RESEARCH_SITES) {
    return { coverage: { ...method, status: 'observations-below-minimum' as const, observedSites: null }, receiptDigests: [] }
  }
  return {
    coverage: { ...method, status: observed.size === sample.size ? 'sample-covered' as const : 'partial-coverage' as const,
      observedSites: observed.size },
    receiptDigests: [...receipts].sort(),
  }
}
