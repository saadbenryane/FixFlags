import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { analysisEnvironmentSourceSql } from '@/lib/sites/application/analysis-scope'

export type RecordedTargetScope = { projectId: string; environment: string; excludeAuditId?: string } & (
  { verificationRule: string; checkIds?: never } | { verificationRule?: never; checkIds: readonly [string, ...string[]] }
)
export type RecordedTargetReader = { $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T> }

/** Shared historical observation boundary for future public checks. Resolved
 * Flags still own monitoring responsibility. Read targets, never whole reports. */
export async function* recordedTargetBatches(input: RecordedTargetScope, db: RecordedTargetReader = prisma) {
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
      ), observations AS (
        SELECT "checkId", "verificationRule" AS rule, "evidenceTargets" AS targets FROM sources
        UNION ALL
        SELECT observation.value->>'checkId', observation.value->>'verificationRule', observation.value->'evidenceTargets'
        FROM sources CROSS JOIN LATERAL jsonb_array_elements(CASE
          WHEN "supportingObservations"->'version' = '1'::jsonb AND jsonb_typeof("supportingObservations"->'items') = 'array'
            THEN "supportingObservations"->'items' ELSE '[]'::jsonb END) observation(value)
      ), targets AS (
        SELECT target.value AS target FROM observations
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(targets) = 'array' THEN targets ELSE '[]'::jsonb END) target(value)
        WHERE ${input.verificationRule !== undefined ? Prisma.sql`rule = ${input.verificationRule}`
          : Prisma.sql`split_part("checkId", '::page:', 1) IN (${Prisma.join(input.checkIds)})`}
          AND jsonb_typeof(target.value->'context') = 'string'
      ) SELECT DISTINCT target FROM targets
        ${after === undefined ? Prisma.empty : Prisma.sql`WHERE target > ${JSON.stringify(after)}::jsonb`}
        ORDER BY target LIMIT ${batchSize}`
    yield rows.map(row => row.target)
    if (rows.length < batchSize) return
    after = rows[rows.length - 1].target
  }
}
