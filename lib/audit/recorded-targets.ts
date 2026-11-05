import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { analysisEnvironmentSourceSql } from '@/lib/sites/application/analysis-scope'
import { recordedFindingArtifactsSql } from './progressive/recorded-findings'

export type RecordedTargetScope = { projectId: string; environment: string; excludeAuditId?: string } & (
  { verificationRule: string; checkIds?: never } | { verificationRule?: never; checkIds: readonly [string, ...string[]] }
)
export type RecordedTargetReader = { $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T> }

/** History reserves work only for identities observed in the current capture.
 * No historical URL can create collection authority or an unbounded result. */
export async function recordedMatchingContexts(input: RecordedTargetScope, candidates: ReadonlySet<string>, db: RecordedTargetReader = prisma) {
  const matched = new Set<string>()
  if (candidates.size) for await (const targets of recordedTargetBatches(input, db, { projection: 'context', matchingContexts: candidates })) {
    for (const target of targets) {
      const context = target && typeof target === 'object' && 'context' in target ? target.context : null
      if (typeof context === 'string' && candidates.has(context)) matched.add(context)
    }
    if (matched.size === candidates.size) break
  }
  return matched
}

/** Shared observation boundary for future public checks. Resolved Flags retain
 * responsibility; unfinished analyses contribute only committed native artifacts.
 * Matching filters and deduplicates
 * current context keys in PostgreSQL. Readers that need only identity avoid
 * transferring display evidence; slow-action readers retain complete targets. */
export async function* recordedTargetBatches(input: RecordedTargetScope, db: RecordedTargetReader = prisma,
  selection?: { projection: 'context'; matchingContexts?: ReadonlySet<string> }) {
  const contexts = selection?.matchingContexts ? [...selection.matchingContexts] : undefined
  if (!input.projectId || contexts?.length === 0) return
  const batchSize = 512
  let after: unknown
  for (;;) {
    const rows = await db.$queryRaw<Array<{ target: unknown }>>`
      WITH sources AS (
        SELECT flag."checkId", flag."verificationRule", flag."evidenceTargets", flag."supportingObservations"
        FROM flags flag JOIN audits "source" ON "source".id = flag."auditId"
        WHERE "source"."projectId" = ${input.projectId} AND "source".id <> ${input.excludeAuditId ?? ''}
          AND "source".status = 'COMPLETED' AND ${analysisEnvironmentSourceSql(input.environment)}
          AND (("source"."executionSpec"->>'scope') IS NULL OR "source"."executionSpec"->>'scope' <> 'FIXTURE_SETUP')
          AND (${input.verificationRule !== undefined ? Prisma.sql`flag."verificationRule" = ${input.verificationRule}`
            : Prisma.sql`split_part(flag."checkId", '::page:', 1) IN (${Prisma.join(input.checkIds)})`}
            OR flag."supportingObservations" IS NOT NULL)
        UNION ALL
        SELECT finding.value->>'checkId', finding.value->>'verificationRule', finding.value->'evidenceTargets', finding.value->'supportingObservations'
          FROM audits "source"
          CROSS JOIN LATERAL (${recordedFindingArtifactsSql(Prisma.sql`"source".id`)}) artifact
          CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(artifact.findings) = 'array'
            THEN artifact.findings ELSE '[]'::jsonb END) finding(value)
          WHERE "source"."projectId" = ${input.projectId} AND "source".id <> ${input.excludeAuditId ?? ''}
            AND "source".status <> 'COMPLETED' AND ${analysisEnvironmentSourceSql(input.environment)}
            AND (("source"."executionSpec"->>'scope') IS NULL OR "source"."executionSpec"->>'scope' <> 'FIXTURE_SETUP')
      ), observations AS (
        SELECT "checkId", "verificationRule" AS rule, "evidenceTargets" AS targets FROM sources
        UNION ALL
        SELECT observation.value->>'checkId', observation.value->>'verificationRule', observation.value->'evidenceTargets'
        FROM sources CROSS JOIN LATERAL jsonb_array_elements(CASE
          WHEN "supportingObservations"->'version' = '1'::jsonb AND jsonb_typeof("supportingObservations"->'items') = 'array'
            THEN "supportingObservations"->'items' ELSE '[]'::jsonb END) observation(value)
      ), targets AS (
        SELECT ${selection ? Prisma.sql`jsonb_build_object('context', target.value->>'context')` : Prisma.sql`target.value`} AS target FROM observations
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(targets) = 'array' THEN targets ELSE '[]'::jsonb END) target(value)
        WHERE ${input.verificationRule !== undefined ? Prisma.sql`rule = ${input.verificationRule}`
          : Prisma.sql`split_part("checkId", '::page:', 1) IN (${Prisma.join(input.checkIds)})`}
          AND jsonb_typeof(target.value->'context') = 'string'
          ${contexts ? Prisma.sql`AND target.value->>'context' = ANY(${contexts}::text[])` : Prisma.empty}
      ) SELECT DISTINCT target FROM targets
        ${after === undefined ? Prisma.empty : Prisma.sql`WHERE target > ${JSON.stringify(after)}::jsonb`}
        ORDER BY target LIMIT ${batchSize}`
    yield rows.map(row => row.target)
    if (rows.length < batchSize) return
    after = rows[rows.length - 1].target
  }
}
