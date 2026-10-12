import { siteAnalysisAuditWhere } from './application/analysis-scope'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { encodeSiteId, siteUrlParts, type SiteRecord } from '@/lib/sites/types'
import { fromStoredWatchInterval } from '@/lib/audit/watch-interval'
import { productNameFromUrl } from '@/lib/audit/product-intelligence'
import { productTransaction } from '@/lib/billing/product-transaction'

/**
 * Resolve or create the customer Site for an analysis.
 * Owned scans attach to Project. Anonymous scans use ProvisionalSite.
 * Never uses graph Site/Page tables.
 */
export async function ensureSiteForAudit(input: {
  url: string
  auditId: string
  userId?: string | null
  projectId?: string | null
  sessionKey?: string | null
}, db: Prisma.TransactionClient = prisma): Promise<SiteRecord> {
  const parts = siteUrlParts(input.url)
  if (!parts) throw new Error('A valid Site hostname is required')

  if (input.projectId) {
    const project = await db.project.findUnique({
      where: { id: input.projectId },
      select: {
        id: true,
        url: true,
        canonicalHost: true,
        name: true,
        userId: true,
        watchInterval: true,
        watchEveryMinutes: true,
        watchNextRunAt: true,
        watchLastRunAt: true,
        watchLastError: true,
        watchConsecutiveFailures: true,
        deletedAt: true,
      },
    })
    if (!project || project.deletedAt) throw new Error('Project not found for Site')
    return {
      siteId: encodeSiteId({ kind: 'project', projectId: project.id }),
      kind: 'project',
      url: project.url,
      canonicalHost: project.canonicalHost,
      name: project.name,
      projectId: project.id,
      provisionalSiteId: null,
      primaryAuditId: input.auditId,
      watchInterval: fromStoredWatchInterval(project.watchInterval),
      watchEveryMinutes: project.watchEveryMinutes,
      watchNextRunAt: project.watchNextRunAt,
      watchLastRunAt: project.watchLastRunAt,
      watchLastError: project.watchLastError,
      watchConsecutiveFailures: project.watchConsecutiveFailures,
      userId: project.userId,
    }
  }

  if (input.userId) {
    const project = await db.project.findUnique({
      where: {
        userId_canonicalHost: {
          userId: input.userId,
          canonicalHost: parts.canonicalHost,
        },
      },
      select: {
        id: true,
        url: true,
        canonicalHost: true,
        name: true,
        userId: true,
        watchInterval: true,
        watchEveryMinutes: true,
        watchNextRunAt: true,
        watchLastRunAt: true,
        watchLastError: true,
        watchConsecutiveFailures: true,
        deletedAt: true,
      },
    })
    if (project && !project.deletedAt) {
      return {
        siteId: encodeSiteId({ kind: 'project', projectId: project.id }),
        kind: 'project',
        url: project.url,
        canonicalHost: project.canonicalHost,
        name: project.name,
        projectId: project.id,
        provisionalSiteId: null,
        primaryAuditId: input.auditId,
        watchInterval: fromStoredWatchInterval(project.watchInterval),
      watchEveryMinutes: project.watchEveryMinutes,
        watchNextRunAt: project.watchNextRunAt,
        watchLastRunAt: project.watchLastRunAt,
        watchLastError: project.watchLastError,
        watchConsecutiveFailures: project.watchConsecutiveFailures,
        userId: project.userId,
      }
    }
  }

  const sessionKey = input.sessionKey?.trim() || `audit:${input.auditId}`
  const provisional = await db.provisionalSite.upsert({
    where: {
      sessionKey_canonicalHost: {
        sessionKey,
        canonicalHost: parts.canonicalHost,
      },
    },
    create: {
      sessionKey,
      canonicalHost: parts.canonicalHost,
      url: parts.canonicalUrl,
      primaryAuditId: input.auditId,
    },
    update: {
      url: parts.canonicalUrl,
      primaryAuditId: input.auditId,
    },
  })

  return {
    siteId: encodeSiteId({ kind: 'provisional', provisionalSiteId: provisional.id }),
    kind: 'provisional',
    url: provisional.url,
    canonicalHost: provisional.canonicalHost,
    name: productNameFromUrl(provisional.url),
    projectId: provisional.claimedProjectId,
    provisionalSiteId: provisional.id,
    primaryAuditId: provisional.primaryAuditId,
    watchInterval: null,
    watchNextRunAt: null,
    watchLastRunAt: null,
    watchLastError: null,
    watchConsecutiveFailures: 0,
    userId: null,
  }
}

export async function loadSiteRecord(siteId: string): Promise<SiteRecord | null> {
  const { parseSiteId } = await import('@/lib/sites/types')
  const ref = parseSiteId(siteId)
  if (!ref) return null

  if (ref.kind === 'project') {
    const project = await prisma.project.findUnique({
      where: { id: ref.projectId },
      select: {
        id: true,
        url: true,
        canonicalHost: true,
        name: true,
        userId: true,
        watchInterval: true,
        watchEveryMinutes: true,
        watchNextRunAt: true,
        watchLastRunAt: true,
        watchLastError: true,
        watchConsecutiveFailures: true,
        deletedAt: true,
        audits: {
          where: siteAnalysisAuditWhere,
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    })
    if (!project || project.deletedAt) return null
    return {
      siteId: ref.siteId,
      kind: 'project',
      url: project.url,
      canonicalHost: project.canonicalHost,
      name: project.name,
      projectId: project.id,
      provisionalSiteId: null,
      primaryAuditId: project.audits[0]?.id ?? null,
      watchInterval: fromStoredWatchInterval(project.watchInterval),
      watchEveryMinutes: project.watchEveryMinutes,
      watchNextRunAt: project.watchNextRunAt,
      watchLastRunAt: project.watchLastRunAt,
      watchLastError: project.watchLastError,
      watchConsecutiveFailures: project.watchConsecutiveFailures,
      userId: project.userId,
    }
  }

  const provisional = await prisma.provisionalSite.findUnique({
    where: { id: ref.provisionalSiteId },
  })
  if (!provisional) return null
  if (provisional.claimedProjectId) {
    return loadSiteRecord(provisional.claimedProjectId)
  }
  return {
    siteId: ref.siteId,
    kind: 'provisional',
    url: provisional.url,
    canonicalHost: provisional.canonicalHost,
    name: productNameFromUrl(provisional.url),
    projectId: null,
    provisionalSiteId: provisional.id,
    primaryAuditId: provisional.primaryAuditId,
    watchInterval: null,
    watchNextRunAt: null,
    watchLastRunAt: null,
    watchLastError: null,
    watchConsecutiveFailures: 0,
    userId: null,
  }
}

/** After claim, point provisional Sites for these audits at the owned Project. */
export async function claimProvisionalSitesForProject(input: {
  userId: string
  projectId: string
  canonicalHost: string
  /** Only claim provisionals tied to these audits (or matching session keys). */
  primaryAuditIds: string[]
  sessionKeys?: string[]
}, db: Prisma.TransactionClient = prisma): Promise<void> {
  const auditIds = input.primaryAuditIds.filter(Boolean)
  const sessionKeys = (input.sessionKeys ?? []).map((k) => k.trim()).filter(Boolean)
  if (auditIds.length === 0 && sessionKeys.length === 0) return

  await db.provisionalSite.updateMany({
    where: {
      canonicalHost: input.canonicalHost,
      claimedProjectId: null,
      OR: [
        ...(auditIds.length > 0 ? [{ primaryAuditId: { in: auditIds } }] : []),
        ...(sessionKeys.length > 0 ? [{ sessionKey: { in: sessionKeys } }] : []),
      ],
    },
    data: { claimedProjectId: input.projectId },
  })
}

/**
 * Move provisional SitePage / SiteOutcome rows onto the owned Project so claim
 * keeps the same Outcomes and pages (including user confirmations).
 */
export async function migrateProvisionalSiteDataToProject(input: {
  projectId: string
  canonicalHost: string
  primaryAuditIds: string[]
}, transaction?: Prisma.TransactionClient): Promise<void> {
  const auditIds = input.primaryAuditIds.filter(Boolean)
  if (auditIds.length === 0) return

  if (!transaction) return productTransaction(tx => migrateProvisionalSiteDataToProject(input, tx))
  const db = transaction

  const provisionals = await db.provisionalSite.findMany({
    where: {
      canonicalHost: input.canonicalHost,
      claimedProjectId: input.projectId,
    },
    select: { id: true },
  })
  if (provisionals.length === 0) return
  const provisionalIds = provisionals.map((p) => p.id)

  const pages = await db.sitePage.findMany({
    where: { provisionalSiteId: { in: provisionalIds } },
  })
  for (const page of pages) {
    const existing = await db.sitePage.findUnique({
      where: {
        projectId_url: { projectId: input.projectId, url: page.url },
      },
    })
    if (existing) {
      const links = await db.siteOutcomePage.findMany({ where: { pageId: page.id }, select: { outcomeId: true } })
      if (links.length) await db.siteOutcomePage.createMany({
        data: links.map(link => ({ outcomeId: link.outcomeId, pageId: existing.id })), skipDuplicates: true,
      })
      await db.sitePage.delete({ where: { id: page.id } })
    } else {
      await db.sitePage.update({
        where: { id: page.id },
        data: { projectId: input.projectId, provisionalSiteId: null },
      })
    }
  }

  const outcomes = await db.siteOutcome.findMany({
    where: { provisionalSiteId: { in: provisionalIds } },
    orderBy: { id: 'asc' },
  })
  for (const outcome of outcomes) {
    let slug = outcome.slug
    let collision = 0
    // A shared label does not establish shared responsibility. Retain the
    // original identity, configuration and history instead of cascading them away.
    while (await db.siteOutcome.findFirst({ where: { projectId: input.projectId, slug }, select: { id: true } })) {
      collision++
      slug = `${outcome.slug}-claimed-${outcome.id}${collision > 1 ? `-${collision}` : ''}`
    }
    await db.siteOutcome.update({
      where: { id: outcome.id },
      data: { projectId: input.projectId, provisionalSiteId: null, ...(slug !== outcome.slug ? { slug } : {}) },
    })
  }
}
