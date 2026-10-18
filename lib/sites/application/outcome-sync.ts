import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { SiteRecord } from '@/lib/sites/types'
import { discoverOutcomePages, discoverJourneyOutcomes } from '@/lib/sites/domain/outcome-discovery'
import { executionTransaction } from '@/lib/audit/execution-ownership'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { observedPurchaseStart } from '@/lib/sites/checkout-inference'
import { buildCheckoutJourneyConfig } from './outcome-bindings'

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
      flags: { select: { checkId: true, pageUrl: true } },
      journeyReviews: {
        select: {
          journeyType: true,
          startUrl: true,
          steps: { select: { url: true, actionType: true, actionDetail: true, elementDescription: true } },
        },
      },
    },
  })
  if (audit.projectId !== input.site.projectId)
    throw new Error('Analysis does not belong to this Site')
  let checkoutOutcomeId: string | null = null
  await executionTransaction(async (tx) => {
    const owner = input.site.projectId
      ? { projectId: input.site.projectId }
      : { provisionalSiteId: input.site.provisionalSiteId! }
    const pages = new Map<string, string>()
    for (const { rawUrl, url: pageUrl, path, title } of discoverOutcomePages(input.site.url, audit)) {
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
        create: { ...owner, url: pageUrl, path, title },
        update: { title },
      })
      pages.set(rawUrl, page.id)
    }
    for (const { kind, name, slug, urls } of discoverJourneyOutcomes(audit.journeyReviews)) {
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
        create: { ...owner, name, slug, kind, inferenceSource: 'browser' },
        update: {},
      })
      if (outcome.inferenceSource === 'user') continue
      const pageIds = new Set(
        urls
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

    const linkedPath = input.site.projectId
      ? await tx.revenuePath.findFirst({
          where: {
            shop: { projectId: input.site.projectId, uninstalledAt: null },
          },
          orderBy: { updatedAt: 'desc' },
          select: { storefrontUrl: true },
        })
      : null
    const startUrl = observedPurchaseStart({
      siteUrl: input.site.url,
      pageUrls: [
        ...audit.pages.map((page) => page.url),
        ...audit.journeyReviews.flatMap((journey) => [
          journey.startUrl,
          ...journey.steps.map((step) => step.url),
        ]),
      ],
      flags: audit.flags,
      steps: audit.journeyReviews.flatMap((journey) => journey.steps),
      storefrontUrl: linkedPath?.storefrontUrl,
    })
    if (startUrl) {
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
      const existing = await tx.siteOutcome.findUnique({
        where,
        select: { inferenceSource: true, confirmedAt: true },
      })
      // A customer-owned Checkout keeps its label and start. Analysis must not replace it.
      if (existing?.inferenceSource !== 'user' && !existing?.confirmedAt) {
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
            confirmedAt: new Date(),
          },
          update: {
            kind: 'CHECKOUT',
            criticality: 'CRITICAL',
            expectation: 'The selected product appears in the cart and checkout opens.',
            confirmedAt: new Date(),
          },
        })
        checkoutOutcomeId = checkout.id
        const bindingConfig = buildCheckoutJourneyConfig(startUrl, false)
        await tx.outcomeExecutionBinding.upsert({
          where: {
            outcomeId_key: { outcomeId: checkout.id, key: 'checkout-browser-v1' },
          },
          create: {
            outcomeId: checkout.id,
            mechanism: 'BROWSER_JOURNEY',
            key: 'checkout-browser-v1',
            config: bindingConfig,
            scope: { device: 'mobile', expected: 'checkout_reached' },
            required: true,
          },
          update: { config: bindingConfig },
        })
      }
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
