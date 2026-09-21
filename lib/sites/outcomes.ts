import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type { SiteRecord } from '@/lib/sites/types'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { currentOutcomeState, type CustomerOutcomeState } from '@/lib/sites/outcome-state'

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'outcome'
  )
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
  kind: 'GENERIC' | 'CHECKOUT'
  expectation: string | null
  assessments: Array<{
    state: 'CLEAR' | 'FLAG' | 'COULD_NOT_VERIFY'
    summary: string
    assessedAt: Date
    validUntil: Date
    improvementId: string | null
    runRequestId: string
  }>
  runRequests: Array<{ id: string; status: string }>
}): Promise<SiteOutcomeView> {
  const pageIds = row.pages.map((p) => p.pageId)
  const latest = row.assessments[0] ?? null
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    inferenceSource:
      row.inferenceSource === 'user'
        ? 'user'
        : row.inferenceSource === 'browser'
          ? 'browser'
          : 'heuristic',
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    pageIds,
    pageUrls: await pageUrlsForIds(pageIds),
    kind: row.kind,
    expectation: row.expectation,
    state: currentOutcomeState(latest),
    summary: latest?.summary ?? 'Not verified yet.',
    lastVerifiedAt: latest?.assessedAt.toISOString() ?? null,
    validUntil: latest?.validUntil.toISOString() ?? null,
    flagId: latest?.improvementId ?? null,
    latestRunId: row.runRequests[0]?.id ?? latest?.runRequestId ?? null,
    running: row.runRequests.some(
      (request) => request.status === 'QUEUED' || request.status === 'RUNNING',
    ),
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
  kind: 'GENERIC' | 'CHECKOUT'
  expectation: string | null
  state: CustomerOutcomeState
  summary: string
  lastVerifiedAt: string | null
  validUntil: string | null
  flagId: string | null
  latestRunId: string | null
  running: boolean
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
      productContract: true,
      pages: { select: { url: true, title: true } },
      flags: { select: { checkId: true, pageUrl: true, problem: true } },
      journeyReviews: {
        select: {
          journeyType: true,
          startUrl: true,
          steps: { select: { url: true } },
        },
      },
    },
  })
  if (audit.projectId !== input.site.projectId)
    throw new Error('Analysis does not belong to this Site')
  let checkoutOutcomeId: string | null = null
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
        : {
            provisionalSiteId_url: {
              provisionalSiteId: input.site.provisionalSiteId!,
              url: pageUrl,
            },
          }
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
        : {
            provisionalSiteId_slug: {
              provisionalSiteId: input.site.provisionalSiteId!,
              slug,
            },
          }
      // Never overwrite a user's label, confirmation, or deliberately edited intent.
      const outcome = await tx.siteOutcome.upsert({
        where,
        create: { ...owner, name, slug, inferenceSource: 'browser' },
        update: {},
      })
      if (outcome.inferenceSource === 'user') continue
      const pageIds = new Set(
        [journey.startUrl, ...journey.steps.map((step) => step.url)]
          .map((url) => pages.get(url))
          .filter((id): id is string => Boolean(id)),
      )
      for (const pageId of pageIds) {
        await tx.siteOutcomePage.upsert({
          where: { outcomeId_pageId: { outcomeId: outcome.id, pageId } },
          create: { outcomeId: outcome.id, pageId },
          update: {},
        })
      }
    }

    const checkoutSignal = [
      JSON.stringify(audit.productContract ?? {}),
      ...audit.flags.flatMap((flag) => [flag.checkId ?? '', flag.problem, flag.pageUrl ?? '']),
      ...audit.pages.map((page) => page.url),
    ].join(' ')
    if (
      /\b(checkout|add.to.cart|purchase|buy.now|payment|\/products?\/|\/cart(?:\/|\b))/i.test(
        checkoutSignal,
      )
    ) {
      const linkedPath = input.site.projectId
        ? await tx.revenuePath.findFirst({
            where: {
              shop: { projectId: input.site.projectId, uninstalledAt: null },
            },
            orderBy: { updatedAt: 'desc' },
            select: { storefrontUrl: true },
          })
        : null
      const flaggedPage = audit.flags.find((flag) =>
        /checkout|cart|purchase|buy/i.test(`${flag.checkId ?? ''} ${flag.problem}`),
      )?.pageUrl
      const productPage = audit.pages.find((page) => /\/products?\//i.test(page.url))?.url
      const startUrl = linkedPath?.storefrontUrl ?? flaggedPage ?? productPage ?? input.site.url
      const where: Prisma.SiteOutcomeWhereUniqueInput = input.site.projectId
        ? {
            projectId_slug: {
              projectId: input.site.projectId,
              slug: 'checkout',
            },
          }
        : {
            provisionalSiteId_slug: {
              provisionalSiteId: input.site.provisionalSiteId!,
              slug: 'checkout',
            },
          }
      const checkout = await tx.siteOutcome.upsert({
        where,
        create: {
          ...owner,
          name: 'Checkout',
          slug: 'checkout',
          description: 'A customer can add a product and reach checkout.',
          kind: 'CHECKOUT',
          expectation: 'The selected product appears in the cart and checkout opens.',
          inferenceSource: 'browser',
        },
        update: {
          kind: 'CHECKOUT',
          expectation: 'The selected product appears in the cart and checkout opens.',
        },
      })
      checkoutOutcomeId = checkout.id
      await tx.outcomeExecutionBinding.upsert({
        where: {
          outcomeId_key: { outcomeId: checkout.id, key: 'checkout-browser-v1' },
        },
        create: {
          outcomeId: checkout.id,
          mechanism: 'BROWSER_JOURNEY',
          key: 'checkout-browser-v1',
          config: { startUrl, safety: 'stop-at-checkout' },
        },
        update: {
          config: { startUrl, safety: 'stop-at-checkout' },
          enabled: true,
        },
      })
    }
  })
  if (checkoutOutcomeId && input.site.projectId) {
    await recordSiteLifecycleEvent({
      name: 'outcome_created',
      idempotencyKey: `outcome-created:${checkoutOutcomeId}`,
      userId: input.site.userId,
      projectId: input.site.projectId,
      properties: { kind: 'checkout', inference: 'browser' },
    }).catch(() => undefined)
  }
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
    include: {
      pages: true,
      assessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      runRequests: { orderBy: { requestedAt: 'desc' }, take: 1 },
    },
  })
  if (!outcome) return null

  const updated = await prisma.siteOutcome.update({
    where: { id: outcome.id },
    data: {
      name: input.name?.trim() || outcome.name,
      inferenceSource: 'user',
      confirmedAt: input.confirmed ? new Date() : null,
    },
    include: {
      pages: true,
      assessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      runRequests: { orderBy: { requestedAt: 'desc' }, take: 1 },
    },
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
    include: {
      pages: true,
      assessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      runRequests: { orderBy: { requestedAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'asc' },
  })

  return Promise.all(rows.map((row) => toOutcomeView(row)))
}
