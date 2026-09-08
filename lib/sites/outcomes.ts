import { prisma } from '@/lib/db'
import { parseProductContract, type ProductContract } from '@/lib/audit/product-contract'
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
    inferenceSource: row.inferenceSource === 'user' ? 'user' : 'heuristic',
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    pageIds,
    pageUrls: await pageUrlsForIds(pageIds),
  }
}

function outcomeNamesFromContract(contract: ProductContract | null): string[] {
  if (!contract) return ['Primary path']
  const names: string[] = []
  for (const outcome of contract.criticalOutcomes) {
    const short = outcome.split(/[.!,]/)[0]?.trim()
    if (short && short.length < 80) names.push(short)
  }
  if (contract.firstValueJourney) {
    const journey = contract.firstValueJourney.split(',')[0]?.trim()
    if (journey && !names.some((n) => n.toLowerCase() === journey.toLowerCase())) {
      names.unshift(journey.length > 48 ? 'Main journey' : journey)
    }
  }
  if (names.length === 0) names.push('Primary path')
  return names.slice(0, 5)
}

export type SiteOutcomeView = {
  id: string
  name: string
  slug: string
  description: string | null
  inferenceSource: 'heuristic' | 'user'
  confirmedAt: string | null
  pageIds: string[]
  pageUrls: string[]
}

export async function syncOutcomesFromAudit(input: {
  site: SiteRecord
  auditId: string
  url: string
}): Promise<SiteOutcomeView[]> {
  const audit = await prisma.audit.findUnique({
    where: { id: input.auditId },
    select: { productContract: true },
  })
  const contract = parseProductContract(audit?.productContract)
  const names = outcomeNamesFromContract(contract)

  const owner =
    input.site.kind === 'project'
      ? { projectId: input.site.projectId! }
      : { provisionalSiteId: input.site.provisionalSiteId! }

  const pageUrl = input.url
  let path = '/'
  try {
    path = new URL(pageUrl).pathname || '/'
  } catch {
    path = '/'
  }

  const page =
    input.site.kind === 'project'
      ? await prisma.sitePage.upsert({
          where: { projectId_url: { projectId: input.site.projectId!, url: pageUrl } },
          create: { ...owner, url: pageUrl, path },
          update: { path },
        })
      : await prisma.sitePage.upsert({
          where: {
            provisionalSiteId_url: {
              provisionalSiteId: input.site.provisionalSiteId!,
              url: pageUrl,
            },
          },
          create: { ...owner, url: pageUrl, path },
          update: { path },
        })

  const views: SiteOutcomeView[] = []
  for (const name of names) {
    const slug = slugify(name)
    const existing = await prisma.siteOutcome.findFirst({
      where: {
        ...owner,
        OR: [{ slug }, { inferenceSource: 'user', name }],
      },
      include: { pages: true },
    })

    if (existing?.inferenceSource === 'user') {
      views.push(await toOutcomeView(existing))
      continue
    }

    const outcome = existing
      ? await prisma.siteOutcome.update({
          where: { id: existing.id },
          data: {
            name,
            description: contract?.firstValueJourney ?? existing.description,
          },
          include: { pages: true },
        })
      : await prisma.siteOutcome.create({
          data: {
            ...owner,
            name,
            slug,
            description: contract?.firstValueJourney ?? null,
            inferenceSource: 'heuristic',
          },
          include: { pages: true },
        })

    await prisma.siteOutcomePage.upsert({
      where: {
        outcomeId_pageId: { outcomeId: outcome.id, pageId: page.id },
      },
      create: { outcomeId: outcome.id, pageId: page.id },
      update: {},
    })

    const pageIds = [...new Set([...outcome.pages.map((p) => p.pageId), page.id])]
    views.push({
      ...(await toOutcomeView({ ...outcome, pages: pageIds.map((pageId) => ({ pageId })) })),
    })
  }

  return views
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
