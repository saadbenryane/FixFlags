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

/** After claim, point provisional Sites at the owned Project. */
export async function claimProvisionalSitesForProject(input: {
  userId: string
  projectId: string
  canonicalHost: string
}): Promise<void> {
  await prisma.provisionalSite.updateMany({
    where: {
      canonicalHost: input.canonicalHost,
      claimedProjectId: null,
    },
    data: { claimedProjectId: input.projectId },
  })
}
