import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { INTERNAL_REVIEW_PAGE_CEILING, monitoringReviewUrls } from '@/lib/audit/review-depth'
import { executionSpecSchema, monitoredBehaviorSchema, type ExecutionSpec } from '../domain/execution-spec'
import { analysisEnvironmentSourceSql, siteWideAnalysisSourceSql } from './analysis-scope'

type ResponsibilityReader = { $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T> }

// Page responsibility depends on the original admitted scope, independently of
// whether today's unrelated binding or detector configuration still decodes.
const pageIntentFields = {
  version: executionSpecSchema.shape.version, engine: executionSpecSchema.shape.engine,
  scope: z.literal('SITE'), targetUrl: executionSpecSchema.shape.targetUrl,
  environment: executionSpecSchema.shape.environment,
  monitoringPages: executionSpecSchema.shape.monitoringPages.unwrap(),
}
const pageIntentSchema = z.object(pageIntentFields).strict().refine(spec => spec.monitoringPages[0] === spec.targetUrl && new Set(spec.monitoringPages).size === spec.monitoringPages.length)

function responsibilitySources(input: { projectId: string; environment: string }, categories = false) {
  return Prisma.sql`SELECT "source"."id", "source"."url", "source"."createdAt",
      CASE WHEN (admitted.intent->>'environment') IS NULL
        THEN admitted.intent || jsonb_build_object('environment', ${input.environment}::text) ELSE admitted.intent END AS "executionSpec",
      ${siteWideAnalysisSourceSql} AS broad
    FROM "audits" "source"
    LEFT JOIN "run_requests" recorded ON recorded."auditId" = "source"."id" AND recorded."projectId" = "source"."projectId"
      AND ("source"."executionSpec"->>'scope') IS NULL
      AND recorded."executionSpec"->'version' = '1'::jsonb AND recorded."executionSpec"->>'scope' = 'SITE'
    CROSS JOIN LATERAL (SELECT COALESCE(recorded."executionSpec", "source"."executionSpec") AS intent) admitted
    WHERE "source"."projectId" = ${input.projectId}
      AND (${siteWideAnalysisSourceSql} ${categories ? Prisma.sql`OR ("source"."executionSpec"->'version' = '1'::jsonb
        AND "source"."executionSpec"->>'scope' = 'CATEGORY')` : Prisma.empty})
      AND ${analysisEnvironmentSourceSql(input.environment)}`
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
          FROM sources s JOIN "audit_verifier_executions" task ON task."auditId" = s."id"
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
          FROM sources s JOIN "audit_verifier_executions" task ON task."auditId" = s."id"
          WHERE task."targetKey" LIKE 'task:%' AND task."pageUrl" IN (${Prisma.join(input.pages)})
            AND (task."workKind" IN ('slow-replay', 'journeys') OR task."workKind" = 'flow'
              AND ((task."workInput"->>'module') IS NULL OR task."workInput"->>'module' = 'pricing-navigation'))
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
