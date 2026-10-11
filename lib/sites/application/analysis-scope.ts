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

/** Historical anonymous analyses have a persisted primary-Site relationship.
 * This adapter proves only that original public analysis, never a later targeted run. */
export function includeLegacySiteAnalyses(ids: string[]): Prisma.AuditWhereInput {
  return ids.length ? { OR: [siteWideAnalysisAuditWhere, {
    id: { in: ids }, executionSpec: { path: ['scope'], equals: Prisma.AnyNull },
    runRequests: { none: { OR: [{ verificationTarget: { not: Prisma.AnyNull } }, { selections: { some: {} } },
      { executionSpec: { path: ['scope'], equals: 'FIXTURE_SETUP' } }] } },
  }] } : siteWideAnalysisAuditWhere
}
