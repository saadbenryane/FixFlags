import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type { SiteRecord } from '@/lib/sites/types'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'outcome'
}

async function pageUrlsForIds(pageIds: string[]): Promise<string[]> {
  if (pageIds.length === 0) return []
  const pages = await prisma.sitePage.findMany({
    where: { id: { in: pageIds } },
    select: { id: true, url: true },
  })
  const byId = new Map(pages.map((p) => [p.id, p.url]))
  return pageIds.map((id) => byId.get(id)).filter((url): url is string => Boolean(url))
}

async function toOutcomeView(row: {
  id: string
  name: string
  slug: string
  description: string | null
  inferenceSource: string
  confirmedAt: Date | null
  pages: Array<{ pageId: string }>
}): Promise<SiteOutcomeView> {
  const pageIds = row.pages.map((p) => p.pageId)
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    inferenceSource: row.inferenceSource === 'user' ? 'user' : row.inferenceSource === 'browser' ? 'browser' : 'heuristic',
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    pageIds,
    pageUrls: await pageUrlsForIds(pageIds),
  }
}

export type SiteOutcomeView = {
  id: string
  name: string
  slug: string
  description: string | null
  inferenceSource: 'heuristic' | 'browser' | 'user'
  confirmedAt: string | null
  pageIds: string[]
  pageUrls: string[]
}

/** Worker projection: only observed pages and browser-planned journeys become Site facts. */
export async function syncOutcomesFromAudit(input: {
  site: SiteRecord
  auditId: string
  url: string
}): Promise<void> {
  const audit = await prisma.audit.findUniqueOrThrow({
    where: { id: input.auditId },
    select: {
      projectId: true,
      pages: { select: { url: true, title: true } },
      journeyReviews: {
        select: { journeyType: true, startUrl: true, steps: { select: { url: true } } },
      },
    },
  })
  if (audit.projectId !== input.site.projectId) throw new Error('Analysis does not belong to this Site')
  await prisma.$transaction(async (tx) => {
    const owner = input.site.projectId
      ? { projectId: input.site.projectId }
      : { provisionalSiteId: input.site.provisionalSiteId! }
    const observed = new Map(audit.pages.map((page) => [page.url, page.title]))
    for (const journey of audit.journeyReviews) {
      observed.set(journey.startUrl, observed.get(journey.startUrl) ?? null)
      for (const step of journey.steps) observed.set(step.url, observed.get(step.url) ?? null)
    }
    const pages = new Map<string, string>()
    for (const [rawUrl, title] of observed) {
      const url = new URL(rawUrl)
      if (!['http:', 'https:'].includes(url.protocol)) continue
      // External steps remain in their original execution; they are not owned Site pages.
      if (url.hostname !== new URL(input.site.url).hostname) continue
      url.hash = ''
      const pageUrl = url.toString()
      const where: Prisma.SitePageWhereUniqueInput = input.site.projectId
        ? { projectId_url: { projectId: input.site.projectId, url: pageUrl } }
        : { provisionalSiteId_url: { provisionalSiteId: input.site.provisionalSiteId!, url: pageUrl } }
      const page = await tx.sitePage.upsert({
        where,
        create: { ...owner, url: pageUrl, path: url.pathname, title },
        update: { title },
      })
      pages.set(rawUrl, page.id)
    }
    for (const journey of audit.journeyReviews) {
      const name = journey.journeyType.trim().replaceAll('_', ' ')
      if (!name) continue
      const slug = slugify(journey.journeyType)
      const where: Prisma.SiteOutcomeWhereUniqueInput = input.site.projectId
        ? { projectId_slug: { projectId: input.site.projectId, slug } }
        : { provisionalSiteId_slug: { provisionalSiteId: input.site.provisionalSiteId!, slug } }
      // Never overwrite a user's label, confirmation, or deliberately edited intent.
      const outcome = await tx.siteOutcome.upsert({
        where,
        create: { ...owner, name, slug, inferenceSource: 'browser' },
        update: {},
      })
      if (outcome.inferenceSource === 'user') continue
      const pageIds = new Set([journey.startUrl, ...journey.steps.map((step) => step.url)]
        .map((url) => pages.get(url)).filter((id): id is string => Boolean(id)))
      for (const pageId of pageIds) {
        await tx.siteOutcomePage.upsert({
          where: { outcomeId_pageId: { outcomeId: outcome.id, pageId } },
          create: { outcomeId: outcome.id, pageId },
          update: {},
        })
      }
    }
  })
}

export async function confirmSiteOutcome(input: {
  site: SiteRecord
  outcomeId: string
  name?: string
  confirmed: boolean
}): Promise<SiteOutcomeView | null> {
  const ownerFilter =
    input.site.kind === 'project'
      ? { projectId: input.site.projectId! }
      : { provisionalSiteId: input.site.provisionalSiteId! }

  const outcome = await prisma.siteOutcome.findFirst({
    where: { id: input.outcomeId, ...ownerFilter },
    include: { pages: true },
  })
  if (!outcome) return null

  const updated = await prisma.siteOutcome.update({
    where: { id: outcome.id },
    data: {
      name: input.name?.trim() || outcome.name,
      inferenceSource: 'user',
      confirmedAt: input.confirmed ? new Date() : null,
    },
    include: { pages: true },
  })

  return toOutcomeView(updated)
}

export async function listSiteOutcomes(site: SiteRecord): Promise<SiteOutcomeView[]> {
  const ownerFilter =
    site.kind === 'project'
      ? { projectId: site.projectId! }
      : { provisionalSiteId: site.provisionalSiteId! }

  const rows = await prisma.siteOutcome.findMany({
    where: ownerFilter,
    include: { pages: true },
    orderBy: { createdAt: 'asc' },
  })

  return Promise.all(rows.map((row) => toOutcomeView(row)))
}
