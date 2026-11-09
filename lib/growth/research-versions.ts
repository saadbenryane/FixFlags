import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { CHECK_REGISTRY, executionCheckModule } from '@/lib/audit/check-registry'
import { recordedFindingArtifactsSql } from '@/lib/audit/progressive/recorded-findings'
import { researchPublicTargetMatchesSite } from './research-sources'
import { PAGE_RESPONSE_RESEARCH_CHECKS, researchHttpCaptureSql, researchHttpTargetsInScope } from './research-page-response-coverage'

const currentModules = JSON.stringify(Object.fromEntries(Object.entries(CHECK_REGISTRY).map(([id, definition]) => [id, definition.module])))
const versionOneModules = JSON.stringify(Object.fromEntries(Object.keys(CHECK_REGISTRY).map(id => [id, executionCheckModule(id, 1)])))
const MAX_PAGE_REFERENCES = 50_000
const collectionTime = z.iso.datetime()

/**
 * Verify both the module receipt and the finding emitted by that task.
 * The optional review fingerprint keeps evidence inside PostgreSQL.
 */
export async function corroboratedResearchVersions(
  tx: Pick<Prisma.TransactionClient, '$queryRaw'>, flagIds: string[], observedBy: Date,
  sources: ReadonlyMap<string, { siteUrl: string; createdAt: Date; completedAt: Date | null }>,
  includeReviewFingerprint = false,
) {
  type Corroboration = { version: number; observationSha256: string | null; receiptDigests: string[] }
  if (!flagIds.length) return new Map<string, Corroboration>()
  const rows = await tx.$queryRaw<Array<Omit<Corroboration, 'version'> & { flagId: string; auditId: string; version: string; pages: string[];
    collectionTimes: string[]; httpTargets?: Array<unknown[]> | null }>>`
    WITH corroborated AS (
      SELECT flag.id AS "flagId", flag."auditId", min(item.value->>'checkVersion') AS version, array_agg(DISTINCT scope.page) AS pages,
        array_agg(DISTINCT item.value #>> '{provenance,collectedAt}') AS "collectionTimes",
        CASE WHEN ${includeReviewFingerprint}
          THEN encode(sha256(convert_to(flag."supportingObservations"::text, 'UTF8')), 'hex')
          ELSE NULL END AS "observationSha256",
        array_agg(DISTINCT proof.digest ORDER BY proof.digest) FILTER (WHERE proof.digest IS NOT NULL) AS "receiptDigests",
        jsonb_agg(DISTINCT proof.targets) FILTER (WHERE proof.targets IS NOT NULL) AS "httpTargets"
      FROM flags flag
      JOIN audits audit ON audit.id = flag."auditId"
      CROSS JOIN LATERAL jsonb_array_elements(CASE
        WHEN flag."supportingObservations"->'version' = '1'::jsonb
          AND jsonb_typeof(flag."supportingObservations"->'items') = 'array'
        THEN CASE WHEN jsonb_array_length(flag."supportingObservations"->'items') <= 5000
          THEN flag."supportingObservations"->'items' ELSE '[]'::jsonb END
        ELSE '[]'::jsonb END) AS item(value)
      CROSS JOIN LATERAL (SELECT
        split_part(flag."checkId", '::page:', 1) AS check_id,
        COALESCE(item.value->>'pageUrl', audit.url) AS page
      ) AS scope
      LEFT JOIN LATERAL (
        SELECT CASE WHEN ${includeReviewFingerprint} THEN encode(sha256(convert_to(
          jsonb_agg(DISTINCT match.fingerprint ORDER BY match.fingerprint)::text, 'UTF8')), 'hex') ELSE NULL END AS digest,
          count(*) > 0 AS matched,
          jsonb_agg(DISTINCT match.targets) FILTER (WHERE match.targets IS NOT NULL) AS targets
        FROM (
          SELECT CASE WHEN ${includeReviewFingerprint} THEN encode(sha256(convert_to(
            (jsonb_build_array(receipt."taskId", receipt."targetKey", receipt."createdAt", receipt.detail,
              emission.id, emission."createdAt", emission."collectedAt", finding.value)
              || CASE WHEN capture.id IS NOT NULL THEN jsonb_build_array(capture.id, capture."collectedAt", capture.targets)
                ELSE '[]'::jsonb END)::text, 'UTF8')), 'hex')
            ELSE NULL END AS fingerprint, capture.targets
          FROM audit_verifier_executions receipt
          JOIN LATERAL (${recordedFindingArtifactsSql(Prisma.sql`flag."auditId"`)}) emission
            ON emission."taskId" = receipt."taskId"
            AND emission."createdAt" BETWEEN audit."createdAt" AND ${observedBy}
            AND emission."collectedAt" = item.value #>> '{provenance,collectedAt}'
          LEFT JOIN LATERAL (${researchHttpCaptureSql}) AS capture
            ON scope.check_id = ANY(${[...PAGE_RESPONSE_RESEARCH_CHECKS]}::text[])
          CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(emission.findings) = 'array'
            THEN CASE WHEN jsonb_array_length(emission.findings) <= 500 THEN emission.findings ELSE '[]'::jsonb END
            ELSE '[]'::jsonb END) AS finding(value)
          WHERE receipt."auditId" = flag."auditId"
            AND receipt."taskId" = item.value #>> '{provenance,taskId}'
            AND receipt.source = 'DETERMINISTIC' AND receipt.status = 'COMPLETED'
            AND receipt."targetKey" = ('module:' || (receipt.detail->>'module'))
            AND receipt.detail->>'kind' = 'site-module-check' AND receipt.detail->'version' = '1'::jsonb
            AND receipt.detail->>'module' = (CASE WHEN item.value->'checkVersion' = '1'::jsonb
              THEN ${versionOneModules}::jsonb ELSE ${currentModules}::jsonb END)->>scope.check_id
            AND receipt."pageUrl" = scope.page AND receipt.detail->>'pageUrl' = scope.page
            AND receipt."createdAt" BETWEEN audit."createdAt" AND ${observedBy}
            AND receipt.detail #>> '{execution,auditId}' = flag."auditId"
            AND receipt.detail #>> '{execution,taskId}' = receipt."taskId"
            AND receipt.detail #>> '{execution,collectedAt}' = emission."collectedAt"
            AND (receipt.detail #> '{execution,checkVersions}') -> scope.check_id = item.value->'checkVersion'
            AND finding.value->>'source' = 'DETERMINISTIC'
            AND finding.value->>'checkId' = item.value->>'checkId'
            AND COALESCE(finding.value->>'pageUrl', audit.url) = scope.page
            AND jsonb_typeof(item.value->'evidence') = 'string'
            AND finding.value->'evidence' = item.value->'evidence'
            AND (scope.check_id <> ALL(${[...PAGE_RESPONSE_RESEARCH_CHECKS]}::text[]) OR (
              receipt.detail->'applicable' = 'true'::jsonb AND receipt.detail->'complete' = 'true'::jsonb
              AND receipt.detail->'passed' = 'false'::jsonb AND receipt.detail->'failed' IS DISTINCT FROM 'true'::jsonb
              AND receipt.detail #>> '{execution,source}' = 'http'
              AND capture.id IS NOT NULL AND capture."collectedAt" = emission."collectedAt"
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(receipt.detail->'assertions') = 'array'
                  THEN CASE WHEN jsonb_array_length(receipt.detail->'assertions') <= 300
                    THEN receipt.detail->'assertions' ELSE '[]'::jsonb END
                  ELSE '[]'::jsonb END) AS assertion(value)
                WHERE assertion.value->>'key' = 'page-response'
                HAVING count(*) = 1 AND bool_and(COALESCE(
                  assertion.value->'passed' = 'false'::jsonb AND assertion.value->'complete' = 'true'::jsonb
                  AND assertion.value->>'disposition' IS NULL
                  AND assertion.value->'observed' = finding.value->'evidence'
                  AND assertion.value->>'context' = finding.value #>> '{evidenceTargets,0,context}', false))
              )
            ))
        ) AS match
      ) AS proof ON true
      WHERE flag.id = ANY(${flagIds}::text[])
      GROUP BY flag.id, flag."auditId"
      HAVING count(DISTINCT item.value->>'checkVersion') = 1
        AND bool_and(COALESCE(
          item.value->>'source' = 'DETERMINISTIC'
          AND split_part(item.value->>'checkId', '::page:', 1) = scope.check_id
          AND jsonb_typeof(item.value->'checkVersion') = 'number'
          AND char_length(scope.page) BETWEEN 1 AND 4200
          AND item.value #>> '{provenance,auditId}' = flag."auditId"
          AND proof.matched, false))
    )
    SELECT "flagId", "auditId", version, pages, "collectionTimes", "observationSha256", "httpTargets",
      coalesce("receiptDigests", ARRAY[]::text[]) AS "receiptDigests"
    FROM (SELECT corroborated.*, sum(cardinality(pages)) OVER () AS page_references,
      sum(cardinality("collectionTimes")) OVER () AS collection_references,
      sum(cardinality("receiptDigests")) OVER () AS receipt_references FROM corroborated) AS bounded
    WHERE page_references <= ${MAX_PAGE_REFERENCES}
      AND collection_references <= ${MAX_PAGE_REFERENCES}
      AND coalesce(receipt_references, 0) <= ${MAX_PAGE_REFERENCES}
  `
  return new Map(rows.flatMap(row => {
    const version = Number(row.version)
    const source = sources.get(row.auditId)
    const completedAt = source?.completedAt
    return source && completedAt && Number.isSafeInteger(version) && version > 0 &&
      row.collectionTimes.every(value => {
        const parsed = collectionTime.safeParse(value)
        if (!parsed.success) return false
        const time = new Date(parsed.data)
        return time >= source.createdAt && time <= completedAt && time <= observedBy
      }) &&
      row.pages.every(page => researchPublicTargetMatchesSite(source.siteUrl, page)) &&
      (row.httpTargets?.every(group => group.every(targets => researchHttpTargetsInScope(source.siteUrl, targets))) ?? true)
      ? [[row.flagId, { version, observationSha256: row.observationSha256, receiptDigests: row.receiptDigests }] as const] : []
  }))
}
