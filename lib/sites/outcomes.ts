import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type { SiteRecord } from '@/lib/sites/types'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { currentOutcomeState, type CustomerOutcomeState } from '@/lib/sites/outcome-state'

function expectationForKind(kind: 'CHECKOUT' | 'SIGNUP' | 'AVAILABILITY'): string {
  if (kind === 'CHECKOUT') return 'The selected product appears in the cart and checkout opens.'
  if (kind === 'SIGNUP') return 'A person can complete the form when FixFlags has a safe, authorized fixture.'
  return 'The public page responds successfully.'
}

function bindingForConfirmedKind(kind: 'CHECKOUT' | 'SIGNUP' | 'AVAILABILITY', siteUrl: string) {
  if (kind === 'CHECKOUT') {
    return {
      key: 'checkout-browser-v1',
      mechanism: 'BROWSER_JOURNEY' as const,
      config: { startUrl: siteUrl, safety: 'stop-at-checkout' },
      scope: { device: 'mobile', expected: 'checkout_reached' },
      required: true,
    }
  }
  if (kind === 'SIGNUP') {
    return {
      key: 'signup-form-v1',
      mechanism: 'SAFE_FORM' as const,
      config: { startUrl: siteUrl, safety: 'protected' },
      required: true,
    }
  }
  return {
    key: 'page-availability-v1',
    mechanism: 'HTTP_AVAILABILITY' as const,
    config: { startUrl: siteUrl },
    required: true,
  }
}

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
  kind: 'GENERIC' | 'CHECKOUT' | 'SIGNUP' | 'AVAILABILITY'
  criticality: 'CRITICAL' | 'IMPORTANT' | 'INFORMATIONAL'
  environment: string
  expectation: string | null
  bindings: Array<{ key: string; required: boolean; scope: Prisma.JsonValue | null }>
  assessments: Array<{
    state: 'CLEAR' | 'FLAG' | 'COULD_NOT_VERIFY'
    summary: string
    assessedAt: Date
    validUntil: Date
    improvementId: string | null
    runRequestId: string
    coverage: Prisma.JsonValue | null
  }>
  runSelections: Array<{ runRequest: { id: string; status: string } }>
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
    criticality: row.criticality,
    environment: row.environment,
    expectation: row.expectation,
    bindings: row.bindings.map((binding) => ({
      key: binding.key,
      required: binding.required,
      scope: binding.scope,
    })),
    coverage: latest?.coverage ?? null,
    state: currentOutcomeState(latest),
    summary: latest?.summary ?? 'Not verified yet.',
    lastVerifiedAt: latest?.assessedAt.toISOString() ?? null,
    validUntil: latest?.validUntil.toISOString() ?? null,
    flagId: latest?.improvementId ?? null,
    latestRunId: row.runSelections[0]?.runRequest.id ?? latest?.runRequestId ?? null,
    running: row.runSelections.some(
      ({ runRequest }) => runRequest.status === 'QUEUED' || runRequest.status === 'RUNNING',
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
  kind: 'GENERIC' | 'CHECKOUT' | 'SIGNUP' | 'AVAILABILITY'
  criticality: 'CRITICAL' | 'IMPORTANT' | 'INFORMATIONAL'
  environment: string
  expectation: string | null
  bindings: Array<{ key: string; required: boolean; scope: Prisma.JsonValue | null }>
  coverage: Prisma.JsonValue | null
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
      ...audit.journeyReviews.map((journey) => journey.journeyType),
    ].join(' ')
    if (
      /\b(checkout|add(?:\s+|-)to(?:\s+|-)cart|purchase|buy(?:\s+|-)now|payment|\/products?\/|\/cart(?:\/|\b))/i.test(
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
      const checkoutJourney = audit.journeyReviews.find((journey) => journey.journeyType === 'checkout')
      const observedStartUrl = linkedPath?.storefrontUrl ?? flaggedPage ?? productPage ?? checkoutJourney?.startUrl
      const startUrl = observedStartUrl ?? input.site.url
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
          criticality: 'CRITICAL',
          expectation: 'The selected product appears in the cart and checkout opens.',
          inferenceSource: 'browser',
        },
        update: {
          kind: 'CHECKOUT',
          criticality: 'CRITICAL',
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
          scope: { device: 'mobile', expected: 'checkout_reached' },
          required: true,
        },
        update: observedStartUrl
          ? { config: { startUrl, safety: 'stop-at-checkout' }, enabled: true }
          : { enabled: true },
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

/** Confirm that the walked page should stay available. Does not invent a purchase path. */
export async function confirmPageAvailability(site: SiteRecord): Promise<SiteOutcomeView | null> {
  if (!site.projectId && !site.provisionalSiteId) return null
  const slug = 'page-loads'
  const where: Prisma.SiteOutcomeWhereUniqueInput = site.projectId
    ? { projectId_slug: { projectId: site.projectId, slug } }
    : { provisionalSiteId_slug: { provisionalSiteId: site.provisionalSiteId!, slug } }
  const owner = site.projectId
    ? { projectId: site.projectId }
    : { provisionalSiteId: site.provisionalSiteId! }
  const row = await prisma.siteOutcome.upsert({
    where,
    create: {
      ...owner,
      name: 'This page loads',
      slug,
      description: 'The public page responds successfully.',
      kind: 'AVAILABILITY',
      criticality: 'IMPORTANT',
      expectation: expectationForKind('AVAILABILITY'),
      inferenceSource: 'browser',
    },
    update: {},
  })
  return confirmSiteOutcome({
    site,
    outcomeId: row.id,
    confirmed: true,
    kind: 'AVAILABILITY',
    name: row.inferenceSource === 'user' ? row.name : 'This page loads',
  })
}

export async function confirmSiteOutcome(input: {
  site: SiteRecord
  outcomeId: string
  name?: string
  confirmed: boolean
  kind?: 'CHECKOUT' | 'SIGNUP' | 'AVAILABILITY'
}): Promise<SiteOutcomeView | null> {
  const ownerFilter =
    input.site.kind === 'project'
      ? { projectId: input.site.projectId! }
      : { provisionalSiteId: input.site.provisionalSiteId! }

  const outcome = await prisma.siteOutcome.findFirst({
    where: { id: input.outcomeId, ...ownerFilter },
    include: {
      pages: true,
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true } },
      assessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      runSelections: { include: { runRequest: true }, orderBy: { runRequest: { requestedAt: 'desc' } }, take: 1 },
    },
  })
  if (!outcome) return null

  if (input.confirmed && input.kind) {
    const binding = bindingForConfirmedKind(input.kind, input.site.url)
    await prisma.outcomeExecutionBinding.upsert({
      where: { outcomeId_key: { outcomeId: outcome.id, key: binding.key } },
      create: { outcomeId: outcome.id, ...binding },
      update: { enabled: true, required: true, mechanism: binding.mechanism, config: binding.config },
    })
  }

  const updated = await prisma.siteOutcome.update({
    where: { id: outcome.id },
    data: {
      name: input.name?.trim() || outcome.name,
      inferenceSource: 'user',
      confirmedAt: input.confirmed ? new Date() : null,
      ...(input.confirmed && input.kind
        ? {
            kind: input.kind,
            criticality: input.kind === 'CHECKOUT' ? 'CRITICAL' as const : 'IMPORTANT' as const,
            expectation: expectationForKind(input.kind),
          }
        : {}),
    },
    include: {
      pages: true,
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true } },
      assessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      runSelections: { include: { runRequest: true }, orderBy: { runRequest: { requestedAt: 'desc' } }, take: 1 },
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
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true } },
      assessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      runSelections: { include: { runRequest: true }, orderBy: { runRequest: { requestedAt: 'desc' } }, take: 1 },
    },
    orderBy: { createdAt: 'asc' },
  })

  return Promise.all(rows.map((row) => toOutcomeView(row)))
}
