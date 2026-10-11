import { Prisma } from '@prisma/client'

/** Setup observations belong to fixture settings and cannot replace Site evidence. */
export const siteAnalysisAuditWhere = {
  OR: [{ executionSpec: { equals: Prisma.DbNull } },
    { NOT: { executionSpec: { path: ['scope'], equals: 'FIXTURE_SETUP' } } }],
} satisfies Prisma.AuditWhereInput
