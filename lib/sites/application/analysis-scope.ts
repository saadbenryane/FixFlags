import { Prisma } from '@prisma/client'

/** Setup observations belong to fixture settings and cannot replace Site evidence. */
export const siteAnalysisAuditWhere = {
  OR: [{ executionSpec: { path: ['scope'], equals: Prisma.AnyNull } },
    { NOT: { executionSpec: { path: ['scope'], equals: 'FIXTURE_SETUP' } } }],
} satisfies Prisma.AuditWhereInput

/** A broad analysis needs a recorded broad intent, not merely absence of a target. */
export const siteWideAnalysisAuditWhere = {
  OR: [
    { AND: [
      { executionSpec: { path: ['version'], equals: 1 } },
      { executionSpec: { path: ['scope'], equals: 'SITE' } },
    ] },
    { AND: [{ executionSpec: { path: ['scope'], equals: Prisma.AnyNull } }, { runRequests: { some: { AND: [
      { executionSpec: { path: ['version'], equals: 1 } },
      { executionSpec: { path: ['scope'], equals: 'SITE' } },
    ] } } }] },
  ],
} satisfies Prisma.AuditWhereInput

/** SQL adapter for the same broad-intent boundary. The source alias is fixed so
 * ledger projections cannot interpolate an untrusted table expression. */
export const siteWideAnalysisSourceSql = Prisma.sql`(
  ("source"."executionSpec"->'version' = '1'::jsonb AND "source"."executionSpec"->>'scope' = 'SITE')
  OR (("source"."executionSpec"->>'scope') IS NULL AND EXISTS (
    SELECT 1 FROM "run_requests" request WHERE request."auditId" = "source"."id"
      AND request."executionSpec"->'version' = '1'::jsonb AND request."executionSpec"->>'scope' = 'SITE'))
)`

/** A physical Audit owns its recorded environment. Before Audit snapshots,
 * request records must agree with each other and their own frozen intent.
 * Only history with no request records retains the legacy production default. */
export function analysisEnvironmentWhere(environment: string): Prisma.AuditWhereInput {
  const matching: Prisma.RunRequestWhereInput = { environment, OR: [
    { executionSpec: { path: ['environment'], equals: environment } },
    { executionSpec: { path: ['environment'], equals: Prisma.AnyNull } },
  ] }
  return { OR: [
    { executionSpec: { path: ['environment'], equals: environment } },
    { AND: [
      { executionSpec: { path: ['environment'], equals: Prisma.AnyNull } },
      { OR: [
        { runRequests: { some: matching, none: { NOT: matching } } },
        ...(environment === 'production' ? [{ runRequests: { none: {} } }] : []),
      ] },
    ] },
  ] }
}

/** Resolve provenance once for SQL projections and verification admission. The
 * source alias is fixed. Conflicting legacy requests cannot establish context. */
export const analysisEnvironmentValueSql = Prisma.sql`(CASE
  WHEN jsonb_typeof("source"."executionSpec"->'environment') = 'string'
    THEN "source"."executionSpec"->>'environment'
  WHEN ("source"."executionSpec"->>'environment') IS NULL THEN
    CASE WHEN NOT EXISTS (SELECT 1 FROM "run_requests" request WHERE request."auditId" = "source"."id")
      THEN 'production'
      ELSE (SELECT MIN(request."environment") FROM "run_requests" request WHERE request."auditId" = "source"."id"
        HAVING COUNT(DISTINCT request."environment") = 1 AND BOOL_AND(
          request."executionSpec"->'environment' = to_jsonb(request."environment")
          OR (request."executionSpec"->>'environment') IS NULL))
    END
  ELSE NULL
END)`

/** SQL adapter for the same environment boundary as the ORM source selector. */
export function analysisEnvironmentSourceSql(environment: string): Prisma.Sql {
  return Prisma.sql`${analysisEnvironmentValueSql} = ${environment}::text`
}

/** Historical anonymous analyses have a persisted primary-Site relationship.
 * This adapter proves only that original public analysis, never a later targeted run. */
export function includeLegacySiteAnalyses(ids: string[]): Prisma.AuditWhereInput {
  return ids.length ? { OR: [siteWideAnalysisAuditWhere, {
    id: { in: ids }, executionSpec: { path: ['scope'], equals: Prisma.AnyNull },
    runRequests: { none: { OR: [{ verificationTarget: { not: Prisma.AnyNull } }, { selections: { some: {} } },
      { executionSpec: { path: ['scope'], equals: 'FIXTURE_SETUP' } }] } },
  }] } : siteWideAnalysisAuditWhere
}
