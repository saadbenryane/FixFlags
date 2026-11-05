import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { INTERNAL_REVIEW_PAGE_CEILING, monitoringReviewUrls } from '@/lib/audit/review-depth'
import { actionContextSchema, executionSpecSchema, monitoredBehaviorSchema, type ExecutionSpec } from '../domain/execution-spec'
import { analysisEnvironmentSourceSql, claimedSiteWideAnalysisSourceSql } from './analysis-scope'
import { consoleObservationMinimum } from '@/lib/audit/console-evidence'
import { recordedTargetBatches, type RecordedTargetReader } from '@/lib/audit/recorded-targets'

type ResponsibilityReader = RecordedTargetReader

/** Keep original console timing through recurrence without replaying whole
 * findings or limiting responsibility to the most recent failures. */
export async function monitoringConsoleResponsibility(input: {
  projectId: string; environment: string; pages: readonly string[];
}, db: ResponsibilityReader = prisma): Promise<NonNullable<ExecutionSpec['consoleObservationScopes']>> {
  if (!input.pages.length) return []
  const windows = new Map<string, number>()
  for await (const targets of recordedTargetBatches({ projectId: input.projectId, environment: input.environment,
    checkIds: ['console-errors-critical', 'console-errors-some'] }, db, { projection: 'context' })) {
    for (const pageUrl of input.pages) {
      const minimum = consoleObservationMinimum(targets, pageUrl)
      if (minimum) windows.set(pageUrl, Math.max(2000, minimum, windows.get(pageUrl) ?? 0))
    }
  }
  return input.pages.flatMap(pageUrl => windows.has(pageUrl) ? [{ pageUrl, minimumMs: windows.get(pageUrl)! }] : [])
}

// Page responsibility depends on the original admitted scope, independently of
// whether today's unrelated binding or detector configuration still decodes.
const pageIntentFields = {
  version: executionSpecSchema.shape.version, engine: executionSpecSchema.shape.engine,
  scope: z.literal('SITE'), targetUrl: executionSpecSchema.shape.targetUrl,
  environment: executionSpecSchema.shape.environment,
  monitoringPages: executionSpecSchema.shape.monitoringPages.unwrap(),
}
const pageIntentSchema = z.object(pageIntentFields).strict().refine(spec => spec.monitoringPages[0] === spec.targetUrl && new Set(spec.monitoringPages).size === spec.monitoringPages.length)

function responsibilitySources(input: { projectId: string; environment: string }, categories = false, diagnostics = false) {
  return Prisma.sql`SELECT "source"."id", "source"."url", "source"."createdAt",
      CASE WHEN (admitted.intent->>'environment') IS NULL
        THEN admitted.intent || jsonb_build_object('environment', ${input.environment}::text) ELSE admitted.intent END AS "executionSpec",
      ${claimedSiteWideAnalysisSourceSql} AS broad
    FROM "audits" "source"
    LEFT JOIN "run_requests" recorded ON recorded."auditId" = "source"."id" AND recorded."projectId" = "source"."projectId"
      AND ("source"."executionSpec"->>'scope') IS NULL
      AND recorded."executionSpec"->'version' = '1'::jsonb AND recorded."executionSpec"->>'scope' = 'SITE'
    CROSS JOIN LATERAL (SELECT COALESCE(recorded."executionSpec", "source"."executionSpec") AS intent) admitted
    WHERE "source"."projectId" = ${input.projectId}
      AND (${claimedSiteWideAnalysisSourceSql} ${categories ? Prisma.sql`OR ("source"."executionSpec"->'version' = '1'::jsonb
        AND "source"."executionSpec"->>'scope' = 'CATEGORY')` : Prisma.empty} ${diagnostics ? Prisma.sql`OR
        ("source"."executionSpec"->'version' = '1'::jsonb AND "source"."executionSpec"->>'scope' = 'DIAGNOSTIC')` : Prisma.empty})
      AND ${analysisEnvironmentSourceSql(input.environment)}`
}

/** Reuse admitted control intent and attributable native receipts. Read only
 * page/context pairs, never whole reports or private collector payloads. These
 * are future observation obligations, not a claim of current health. */
export async function monitoringActionResponsibility(input: {
  projectId: string; environment: string; pages: readonly string[];
}, db: ResponsibilityReader = prisma): Promise<Map<string, string[]>> {
  if (!input.pages.length) return new Map()
  const rows = await db.$queryRaw<Array<{ pageUrl: string; context: string }>>`
    WITH sources AS MATERIALIZED (${responsibilitySources(input, true, true)}), candidates AS (
      SELECT scope.value->>'pageUrl' AS "pageUrl", member.value #>> '{}' AS context
        FROM sources s CROSS JOIN LATERAL jsonb_array_elements(CASE
          WHEN s."executionSpec"->>'scope' IN ('SITE', 'CATEGORY') AND jsonb_typeof(s."executionSpec"->'monitoringBehaviors') = 'array'
            THEN s."executionSpec"->'monitoringBehaviors' ELSE '[]'::jsonb END || CASE
          WHEN s."executionSpec"->>'scope' = 'DIAGNOSTIC' AND jsonb_typeof(s."executionSpec"->'verificationScopes') = 'array'
            THEN s."executionSpec"->'verificationScopes' ELSE '[]'::jsonb END) scope(value)
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(scope.value->'actionContexts') = 'array'
          THEN scope.value->'actionContexts' ELSE '[]'::jsonb END) member(value)
        WHERE s."executionSpec"->'version' = '1'::jsonb AND s."executionSpec"->>'targetUrl' = s."url"
          AND scope.value->>'pageUrl' IN (${Prisma.join(input.pages)})
      UNION ALL
      SELECT task."pageUrl", assertion.value->>'context'
        FROM sources s JOIN "audit_verifier_executions" receipt ON receipt."auditId" = s."id"
        JOIN "audit_execution_tasks" task ON task."id" = receipt."taskId" AND task."auditId" = s."id"
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(receipt.detail->'assertions') = 'array'
          THEN receipt.detail->'assertions' ELSE '[]'::jsonb END) assertion(value)
        WHERE receipt."targetKey" IN ('module:flow', 'module:form-validation') AND receipt.status = 'COMPLETED'
          AND receipt.detail->>'kind' = 'site-module-check' AND receipt.detail->'version' = '1'::jsonb
          AND receipt.detail->'execution'->>'auditId' = s."id" AND receipt.detail->'execution'->>'taskId' = task."id"
          AND receipt.detail->'execution'->>'source' = 'rendered-dom' AND task."pageUrl" IN (${Prisma.join(input.pages)})
          AND (receipt."targetKey" = 'module:flow' AND receipt.detail->>'module' = 'flow'
            AND assertion.value->>'key' IN ('primary-action-click', 'primary-action-navigation', 'primary-action-response', 'pricing-navigation')
            OR receipt."targetKey" = 'module:form-validation' AND receipt.detail->>'module' = 'form-validation'
              AND assertion.value->>'key' IN ('empty-form-validation', 'form-feedback'))
    ) SELECT DISTINCT "pageUrl", context FROM candidates
      WHERE context ~ '^(form:|flow:control:|flow:pricing:v1:)[a-f0-9]{64}$' ORDER BY "pageUrl", context`
  const scopes = new Map<string, string[]>()
  for (const row of rows) {
    if (!input.pages.includes(row.pageUrl) || !actionContextSchema.safeParse(row.context).success) continue
    if (!scopes.has(row.pageUrl)) scopes.set(row.pageUrl, [])
    scopes.get(row.pageUrl)!.push(row.context)
  }
  return scopes
}

/** Merge independently admitted branches without copying historical observations
 * or treating the latest report as authority to retire earlier responsibilities. */
export async function monitoringResponsibility(input: {
  projectId: string; environment: string; targetUrl: string; recorded: readonly unknown[];
}, db: ResponsibilityReader = prisma): Promise<string[]> {
  let pages = monitoringReviewUrls(input.targetUrl, input.recorded)
  const batch = INTERNAL_REVIEW_PAGE_CEILING * 2
  for (let offset = 0; pages.length < INTERNAL_REVIEW_PAGE_CEILING; offset += batch) {
    // PostgreSQL deduplicates the small scope projection. Do not read whole
    // reports, collector artifacts, HTML, credentials or historical findings.
    // Physical task reads repeat the namespace and kind predicates required
    // by the admitted-scope partial index; the historical view supplied them.
    const candidates = await db.$queryRaw<Array<{ url: string; sourceUrl: string; intent: unknown }>>`
      WITH sources AS MATERIALIZED (
        ${responsibilitySources(input)}
      ), candidates AS (
        SELECT s."id", s."createdAt", s."url" AS "sourceUrl", s."url", 0 AS priority, NULL::jsonb AS intent FROM sources s
        UNION ALL
        SELECT s."id", s."createdAt", s."url", page."url", 25 + page."position", NULL::jsonb
          FROM sources s JOIN "audit_pages" page ON page."auditId" = s."id"
        UNION ALL
        SELECT s."id", s."createdAt", s."url", task."pageUrl", 50, NULL::jsonb
          FROM sources s JOIN "audit_execution_tasks" task ON task."auditId" = s."id"
          WHERE task."targetKey" LIKE 'task:%' AND task."workKind" = 'browser' AND task."pageUrl" IS NOT NULL
        UNION ALL
        SELECT s."id", s."createdAt", s."url", member.value #>> '{}', member.ordinality::int,
          jsonb_build_object('version', s."executionSpec"->'version', 'scope', s."executionSpec"->'scope',
            'targetUrl', s."executionSpec"->'targetUrl', 'environment', s."executionSpec"->'environment',
            'monitoringPages', s."executionSpec"->'monitoringPages') || CASE WHEN s."executionSpec" ? 'engine'
              THEN jsonb_build_object('engine', s."executionSpec"->'engine') ELSE '{}'::jsonb END
          FROM sources s CROSS JOIN LATERAL jsonb_array_elements(CASE
            WHEN jsonb_typeof(s."executionSpec"->'monitoringPages') = 'array' THEN CASE
              WHEN jsonb_array_length(s."executionSpec"->'monitoringPages') BETWEEN 1 AND ${INTERNAL_REVIEW_PAGE_CEILING}
                THEN s."executionSpec"->'monitoringPages' ELSE '[]'::jsonb END ELSE '[]'::jsonb END)
            WITH ORDINALITY member(value, ordinality)
          WHERE jsonb_typeof(member.value) = 'string'
      ), distinct_candidates AS (
        SELECT DISTINCT ON ("url", intent) * FROM candidates
        ORDER BY "url", intent, "createdAt" DESC, "id" DESC, priority
      )
      SELECT "url", "sourceUrl", intent FROM distinct_candidates
      ORDER BY "createdAt" DESC, "id" DESC, priority, "url", intent
      LIMIT ${batch} OFFSET ${offset}`
    for (const candidate of candidates) {
      if (candidate.intent !== null) {
        const intent = pageIntentSchema.safeParse(candidate.intent)
        if (!intent.success || intent.data.targetUrl !== candidate.sourceUrl || intent.data.environment !== input.environment) continue
      }
      pages = monitoringReviewUrls(input.targetUrl, [...pages, candidate.url])
    }
    if (candidates.length < batch) break
  }
  return pages
}

/** Preserve admitted public behavior, independently of a task's outcome. A
 * category check cannot silently lose its page-specific work in the next Watch. */
export async function monitoringBehaviorResponsibility(input: {
  projectId: string; environment: string; pages: readonly string[]; recordedEntries?: readonly string[];
  recordedBehaviors?: ExecutionSpec['monitoringBehaviors'];
}, db: ResponsibilityReader = prisma): Promise<NonNullable<ExecutionSpec['monitoringBehaviors']>> {
  const behaviorOrder = monitoredBehaviorSchema.options
  const selected = new Set(input.pages), scopes = new Map<string, Set<typeof behaviorOrder[number]>>()
  const add = (url: string, behaviors: readonly typeof behaviorOrder[number][]) => {
    if (!selected.has(url)) return
    if (!scopes.has(url)) scopes.set(url, new Set())
    for (const behavior of behaviors) scopes.get(url)!.add(behavior)
  }
  if (!input.pages.length) return []
  add(input.pages[0], behaviorOrder)
  for (const url of input.recordedEntries ?? []) add(url, behaviorOrder)
  for (const scope of input.recordedBehaviors ?? []) add(scope.pageUrl, scope.behaviors)
  const batch = INTERNAL_REVIEW_PAGE_CEILING * 2
  for (let offset = 0; !input.pages.every(page => scopes.get(page)?.size === behaviorOrder.length); offset += batch) {
    const candidates = await db.$queryRaw<Array<{ url: string | null; behavior: string; sourceUrl: string; intent: unknown }>>`
      WITH sources AS MATERIALIZED (${responsibilitySources(input, true)}), candidates AS (
        SELECT s."id", s."createdAt", s."url" AS "sourceUrl", s."url", 'entry'::text AS behavior, NULL::jsonb AS intent
          FROM sources s WHERE s.broad AND s."url" IN (${Prisma.join(input.pages)})
        UNION ALL
        SELECT s."id", s."createdAt", s."url", task."pageUrl", CASE
          WHEN task."workKind" = 'flow' THEN COALESCE(task."workInput"->>'module', 'flow') ELSE task."workKind" END, NULL::jsonb
          FROM sources s JOIN "audit_execution_tasks" task ON task."auditId" = s."id"
          WHERE task."targetKey" LIKE 'task:%' AND task."pageUrl" IS NOT NULL AND task."pageUrl" IN (${Prisma.join(input.pages)})
            AND task."workKind" IN ('flow', 'slow-replay', 'journeys')
            AND (task."workKind" <> 'flow' OR (task."workInput"->>'module') IS NULL OR task."workInput"->>'module' = 'pricing-navigation')
        UNION ALL
        SELECT s."id", s."createdAt", s."url", NULL::text, 'snapshot',
          jsonb_strip_nulls(jsonb_build_object('version', s."executionSpec"->'version', 'engine', s."executionSpec"->'engine',
            'scope', s."executionSpec"->'scope', 'targetUrl', s."executionSpec"->'targetUrl', 'environment', s."executionSpec"->'environment',
            'monitoringPages', s."executionSpec"->'monitoringPages', 'category', s."executionSpec"->'category',
            'monitoringEntryPages', s."executionSpec"->'monitoringEntryPages', 'monitoringBehaviors', s."executionSpec"->'monitoringBehaviors'))
          FROM sources s WHERE s."executionSpec" ? 'monitoringEntryPages' OR s."executionSpec" ? 'monitoringBehaviors'
      ), distinct_candidates AS (
        SELECT DISTINCT ON ("url", behavior, intent) * FROM candidates
        ORDER BY "url", behavior, intent, "createdAt" DESC, "id" DESC
      ) SELECT "url", behavior, "sourceUrl", intent FROM distinct_candidates
        ORDER BY "createdAt" DESC, "id" DESC, "url", behavior, intent LIMIT ${batch} OFFSET ${offset}`
    for (const candidate of candidates) {
      if (candidate.intent !== null) {
        const intent = executionSpecSchema.safeParse({ ...(candidate.intent as object), checks: {}, outcomes: [], verificationTarget: null })
        if (!intent.success || intent.data.targetUrl !== candidate.sourceUrl || intent.data.environment !== input.environment) continue
        for (const page of intent.data.monitoringEntryPages ?? []) add(page, behaviorOrder)
        for (const scope of intent.data.monitoringBehaviors ?? []) add(scope.pageUrl, scope.behaviors)
      } else if (candidate.url) {
        if (candidate.behavior === 'entry') add(candidate.url, behaviorOrder)
        else {
          const behavior = monitoredBehaviorSchema.safeParse(candidate.behavior)
          if (behavior.success) add(candidate.url, [behavior.data])
        }
      }
    }
    if (candidates.length < batch) break
  }
  return input.pages.flatMap(pageUrl => scopes.has(pageUrl) ? [{ pageUrl, behaviors: behaviorOrder.filter(behavior => scopes.get(pageUrl)!.has(behavior)) }] : [])
}
