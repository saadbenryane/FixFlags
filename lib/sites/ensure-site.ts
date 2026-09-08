import { prisma } from '@/lib/db'
import { encodeSiteId, siteUrlParts, type SiteRecord } from '@/lib/sites/types'
import { fromStoredWatchInterval } from '@/lib/audit/project-watch'
import { productNameFromUrl } from '@/lib/audit/product-intelligence'

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
}): Promise<SiteRecord> {
  const parts = siteUrlParts(input.url)
  if (!parts) throw new Error('A valid Site hostname is required')

  if (input.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: {
        id: true,
        url: true,
        canonicalHost: true,
        name: true,
        userId: true,
        watchInterval: true,
        watchNextRunAt: true,
        watchLastRunAt: true,
      },
    })
    if (!project) throw new Error('Project not found for Site')
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
      watchNextRunAt: project.watchNextRunAt,
      watchLastRunAt: project.watchLastRunAt,
      userId: project.userId,
    }
  }

  if (input.userId) {
    const project = await prisma.project.findUnique({
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
        watchNextRunAt: true,
        watchLastRunAt: true,
      },
    })
    if (project) {
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
        watchNextRunAt: project.watchNextRunAt,
        watchLastRunAt: project.watchLastRunAt,
        userId: project.userId,
      }
    }
  }

  const sessionKey = input.sessionKey?.trim() || `audit:${input.auditId}`
  const provisional = await prisma.provisionalSite.upsert({
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
        watchNextRunAt: true,
        watchLastRunAt: true,
        audits: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    })
    if (!project) return null
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
      watchNextRunAt: project.watchNextRunAt,
      watchLastRunAt: project.watchLastRunAt,
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
}): Promise<void> {
  const auditIds = input.primaryAuditIds.filter(Boolean)
  const sessionKeys = (input.sessionKeys ?? []).map((k) => k.trim()).filter(Boolean)
  if (auditIds.length === 0 && sessionKeys.length === 0) return

  await prisma.provisionalSite.updateMany({
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
}): Promise<void> {
  const auditIds = input.primaryAuditIds.filter(Boolean)
  if (auditIds.length === 0) return

  const provisionals = await prisma.provisionalSite.findMany({
    where: {
      canonicalHost: input.canonicalHost,
      OR: [
        { claimedProjectId: input.projectId },
        { primaryAuditId: { in: auditIds } },
      ],
    },
    select: { id: true },
  })
  if (provisionals.length === 0) return
  const provisionalIds = provisionals.map((p) => p.id)

  const pages = await prisma.sitePage.findMany({
    where: { provisionalSiteId: { in: provisionalIds } },
  })
  for (const page of pages) {
    const existing = await prisma.sitePage.findUnique({
      where: {
        projectId_url: { projectId: input.projectId, url: page.url },
      },
    })
    if (existing) {
      await prisma.siteOutcomePage.updateMany({
        where: { pageId: page.id },
        data: { pageId: existing.id },
      })
      await prisma.sitePage.delete({ where: { id: page.id } })
    } else {
      await prisma.sitePage.update({
        where: { id: page.id },
        data: { projectId: input.projectId, provisionalSiteId: null },
      })
    }
  }

  const outcomes = await prisma.siteOutcome.findMany({
    where: { provisionalSiteId: { in: provisionalIds } },
  })
  for (const outcome of outcomes) {
    const existing = await prisma.siteOutcome.findFirst({
      where: {
        projectId: input.projectId,
        slug: outcome.slug,
      },
    })
    if (existing) {
      await prisma.siteOutcomePage.updateMany({
        where: { outcomeId: outcome.id },
        data: { outcomeId: existing.id },
      })
      // Prefer user confirmation from provisional when owned row is still heuristic.
      if (outcome.confirmedAt && !existing.confirmedAt) {
        await prisma.siteOutcome.update({
          where: { id: existing.id },
          data: {
            name: outcome.name,
            description: outcome.description,
            inferenceSource: outcome.inferenceSource,
            confirmedAt: outcome.confirmedAt,
          },
        })
      }
      await prisma.siteOutcome.delete({ where: { id: outcome.id } })
    } else {
      await prisma.siteOutcome.update({
        where: { id: outcome.id },
        data: { projectId: input.projectId, provisionalSiteId: null },
      })
    }
  }
}
