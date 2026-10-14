import { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))
import { ISSUE_AGGREGATES_SQL } from '../issue-rollup'

const databaseUrl = process.env.GROWTH_TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('issue rollup on PostgreSQL temporary fixtures', () => {
  it('counts observations once across multiple technologies, fingerprints, and sites', async () => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('Growth SQL fixtures require a loopback PostgreSQL database')
    }
    const db = new PrismaClient({ datasourceUrl: databaseUrl })
    try {
      await db.$transaction(async (tx) => {
        // Temporary tables shadow existing tables for this connection only.
        await tx.$executeRawUnsafe('CREATE TEMP TABLE graph_issue (id text, "checkId" text) ON COMMIT DROP')
        await tx.$executeRawUnsafe('CREATE TEMP TABLE graph_issue_occurrence (id text, "issueId" text, "siteId" text) ON COMMIT DROP')
        await tx.$executeRawUnsafe('CREATE TEMP TABLE graph_site_technology ("siteId" text, "technologyId" text, "isCurrent" boolean) ON COMMIT DROP')
        await tx.$executeRawUnsafe('CREATE TEMP TABLE graph_technology (id text, kind text) ON COMMIT DROP')
        await tx.$executeRawUnsafe(`INSERT INTO graph_issue VALUES ('i1', 'check-one'), ('i2', 'check-one'), ('i3', 'empty-check')`)
        await tx.$executeRawUnsafe(`INSERT INTO graph_issue_occurrence VALUES ('o1', 'i1', 's1'), ('o2', 'i2', 's1'), ('o3', 'i1', 's2')`)
        await tx.$executeRawUnsafe(`INSERT INTO graph_technology VALUES ('t1', 'framework'), ('t2', 'hosting'), ('t3', 'framework'), ('t4', 'framework')`)
        await tx.$executeRawUnsafe(`INSERT INTO graph_site_technology VALUES ('s1', 't1', true), ('s1', 't2', true), ('s1', 't3', false), ('s1', 't4', true)`)

        const rows = await tx.$queryRaw<Array<{ id: string; occurrence_count: bigint; site_count: bigint; framework_count: bigint }>>(ISSUE_AGGREGATES_SQL)
        expect(rows.find((row) => row.id === 'check-one')).toEqual({ id: 'check-one', occurrence_count: 3n, site_count: 2n, framework_count: 2n })
        expect(rows.find((row) => row.id === 'empty-check')).toEqual({ id: 'empty-check', occurrence_count: 0n, site_count: 0n, framework_count: 0n })
      })
    } finally {
      await db.$disconnect()
    }
  })
})
