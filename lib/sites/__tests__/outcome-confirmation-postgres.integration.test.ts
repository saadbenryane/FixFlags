import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { confirmSiteOutcome, renameSiteOutcome } from '@/lib/sites/outcomes'
import type { SiteRecord } from '@/lib/sites/types'

const runPostgres = process.env.OUTCOME_CONFIRMATION_DB_REQUIRED === 'true' ? describe : describe.skip

runPostgres('Outcome confirmation PostgreSQL serialization', () => {
  let userId = ''
  let projectId = ''
  let site: SiteRecord

  beforeEach(async () => {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL is required')
    const hostname = new URL(databaseUrl).hostname
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      throw new Error('Outcome confirmation integration tests require a local PostgreSQL database')
    }

    const suffix = randomUUID()
    userId = `outcome-confirmation-user-${suffix}`
    projectId = `outcome-confirmation-project-${suffix}`
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        preferredTools: [],
      },
    })
    await prisma.project.create({
      data: {
        id: projectId,
        userId,
        name: 'Outcome confirmation fixture',
        url: 'https://example.com/',
        canonicalHost: 'example.com',
      },
    })
    site = {
      siteId: projectId,
      kind: 'project',
      projectId,
      provisionalSiteId: null,
      url: 'https://example.com/',
      canonicalHost: 'example.com',
      name: 'Outcome confirmation fixture',
      primaryAuditId: null,
      watchInterval: null,
      watchNextRunAt: null,
      watchLastRunAt: null,
      watchLastError: null,
      watchConsecutiveFailures: 0,
      userId,
    }
  })

  afterEach(async () => {
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  async function genericOutcome(slug: string) {
    return prisma.siteOutcome.create({
      data: {
        projectId,
        name: 'A customer can complete an important action',
        slug,
        inferenceSource: 'browser',
      },
    })
  }

  it('never leaves an enabled binding behind when a concurrent withdrawal wins', async () => {
    for (let index = 0; index < 8; index += 1) {
      const outcome = await genericOutcome(`race-${index}`)
      await Promise.all([
        confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'CHECKOUT' }),
        confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: false }),
      ])

      const stored = await prisma.siteOutcome.findUniqueOrThrow({
        where: { id: outcome.id },
        include: { bindings: { where: { enabled: true } } },
      })
      if (stored.confirmedAt === null) {
        expect(stored.bindings, 'an unconfirmed Outcome must not execute unattended').toHaveLength(0)
      } else {
        expect(stored.bindings.map((binding) => binding.key)).toEqual(['checkout-browser-v1'])
      }
    }
  })

  it('keeps a customer rename and the original time across a repeated same-kind request', async () => {
    const outcome = await genericOutcome('same-kind')
    await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'CHECKOUT' })
    await renameSiteOutcome({
      site,
      outcomeId: outcome.id,
      name: 'A customer can buy the annual plan',
    })
    const before = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })

    await confirmSiteOutcome({ site, outcomeId: outcome.id, confirmed: true, kind: 'CHECKOUT' })

    const after = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })
    expect(after.name).toBe('A customer can buy the annual plan')
    expect(after.confirmedAt?.toISOString()).toBe(before.confirmedAt?.toISOString())
  })

  it('does not wait on or touch a foreign tenant Outcome row', async () => {
    const foreignProject = await prisma.project.create({
      data: {
        userId,
        name: 'Foreign Outcome fixture',
        url: 'https://other.example/',
        canonicalHost: 'other.example',
      },
    })
    const foreignOutcome = await prisma.siteOutcome.create({
      data: {
        projectId: foreignProject.id,
        name: 'Foreign purchase',
        slug: 'foreign-purchase',
        kind: 'CHECKOUT',
        inferenceSource: 'user',
        confirmedAt: new Date('2026-09-29T00:00:00.000Z'),
      },
    })

    let releaseLock: (() => void) | undefined
    const release = new Promise<void>((resolve) => { releaseLock = resolve })
    let announceLock: (() => void) | undefined
    const locked = new Promise<void>((resolve) => { announceLock = resolve })
    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "site_outcomes"
        WHERE "id" = ${foreignOutcome.id}
        FOR UPDATE
      `)
      announceLock?.()
      await release
    })
    await locked

    const attempted = confirmSiteOutcome({
      site,
      outcomeId: foreignOutcome.id,
      confirmed: false,
    })
    const timeout = Symbol('foreign lock timeout')
    let observed: Awaited<typeof attempted> | typeof timeout
    try {
      observed = await Promise.race([
        attempted,
        new Promise<typeof timeout>((resolve) => setTimeout(() => resolve(timeout), 1_000)),
      ])
      expect(observed, 'a foreign row lock must not contend with this tenant').not.toBe(timeout)
      expect(observed).toBeNull()
    } finally {
      releaseLock?.()
      await holder
      await attempted
    }

    const unchanged = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: foreignOutcome.id } })
    expect(unchanged.confirmedAt?.toISOString()).toBe('2026-09-29T00:00:00.000Z')
    expect(unchanged.name).toBe('Foreign purchase')
  })
})
