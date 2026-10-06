import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteRecord } from '@/lib/sites/types'

const mocks = vi.hoisted(() => ({
  auditFindUniqueOrThrow: vi.fn(),
  sitePageUpsert: vi.fn(),
  siteOutcomeUpsert: vi.fn(),
  siteOutcomeFindUnique: vi.fn(),
  siteOutcomePageUpsert: vi.fn(),
  revenuePathFindFirst: vi.fn(),
  bindingUpsert: vi.fn(),
  recordSiteLifecycleEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    audit: { findUniqueOrThrow: mocks.auditFindUniqueOrThrow },
    $transaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        sitePage: { upsert: mocks.sitePageUpsert },
        siteOutcome: { upsert: mocks.siteOutcomeUpsert, findUnique: mocks.siteOutcomeFindUnique },
        siteOutcomePage: { upsert: mocks.siteOutcomePageUpsert },
        revenuePath: { findFirst: mocks.revenuePathFindFirst },
        outcomeExecutionBinding: { upsert: mocks.bindingUpsert },
      }),
  },
}))

vi.mock('@/lib/analytics/site-events', () => ({
  recordSiteLifecycleEvent: mocks.recordSiteLifecycleEvent,
}))

import { observedPurchaseStart } from '@/lib/sites/checkout-inference'
import { syncOutcomesFromAudit } from '@/lib/sites/outcomes'

const PRICING_PROSE = {
  firstValueJourney: 'Open pricing, compare plans, and start checkout or signup',
  criticalOutcomes: ['Pricing is readable and the buy or start path works'],
}

function projectSite(overrides: Partial<SiteRecord> = {}): SiteRecord {
  return {
    siteId: 'project-1',
    kind: 'project',
    url: 'https://shop.example',
    canonicalHost: 'shop.example',
    name: 'Shop',
    projectId: 'project-1',
    provisionalSiteId: null,
    primaryAuditId: 'audit-1',
    watchInterval: null,
    watchNextRunAt: null,
    watchLastRunAt: null,
    watchLastError: null,
    watchConsecutiveFailures: 0,
    userId: 'user-1',
    ...overrides,
  }
}

function prime(audit: Record<string, unknown>) {
  mocks.auditFindUniqueOrThrow.mockResolvedValue({
    projectId: 'project-1',
    pages: [],
    flags: [],
    journeyReviews: [],
    productContract: PRICING_PROSE,
    ...audit,
  })
}

async function sync(audit: Record<string, unknown>, site = projectSite()) {
  prime(audit)
  await syncOutcomesFromAudit({ site, auditId: 'audit-1', url: site.url })
}

function boundStartUrl(): string | undefined {
  const call = mocks.bindingUpsert.mock.calls.at(-1)?.[0] as
    | { create?: { config?: { startUrl?: string } } }
    | undefined
  return call?.create?.config?.startUrl
}

describe('observedPurchaseStart', () => {
  it('prefers a product page over a cart, a storefront homepage, and a checkout URL', () => {
    expect(
      observedPurchaseStart({
        siteUrl: 'https://shop.example',
        pageUrls: [
          'https://shop.example/checkout',
          'https://shop.example/cart',
          'https://shop.example/collections/frontpage/products/tote',
        ],
        storefrontUrl: 'https://shop.example/',
      }),
    ).toBe('https://shop.example/collections/frontpage/products/tote')
  })

  it('uses the page where a buy was recorded when no product URL exists', () => {
    expect(
      observedPurchaseStart({
        siteUrl: 'https://shop.example',
        pageUrls: ['https://shop.example/checkout'],
        steps: [
          { url: 'https://shop.example/collections/summer', actionType: 'add_to_cart' },
          { url: 'https://shop.example/checkout', actionType: 'navigate', label: 'checkout' },
        ],
      }),
    ).toBe('https://shop.example/collections/summer')
  })

  it('does not treat a checkout label or checkout-only URL as a start', () => {
    expect(
      observedPurchaseStart({
        siteUrl: 'https://shop.example',
        pageUrls: ['https://shop.example/checkout', 'https://shop.example/thank-you'],
        steps: [{ url: 'https://shop.example/checkout', actionType: 'navigate', label: 'checkout' }],
        storefrontUrl: 'https://shop.example/checkout',
      }),
    ).toBeNull()
  })
})

describe('syncOutcomesFromAudit checkout inference', () => {
  beforeEach(() => {
    mocks.auditFindUniqueOrThrow.mockReset()
    mocks.sitePageUpsert.mockReset().mockImplementation(async ({ create }: { create: { url: string } }) => ({
      id: `page-${create.url}`,
    }))
    mocks.siteOutcomeUpsert.mockReset().mockResolvedValue({
      id: 'outcome-checkout',
      inferenceSource: 'browser',
      confirmedAt: null,
    })
    mocks.siteOutcomeFindUnique.mockReset().mockResolvedValue(null)
    mocks.siteOutcomePageUpsert.mockReset().mockResolvedValue({})
    mocks.revenuePathFindFirst.mockReset().mockResolvedValue(null)
    mocks.bindingUpsert.mockReset().mockResolvedValue({ id: 'binding-1' })
    mocks.recordSiteLifecycleEvent.mockReset().mockResolvedValue(undefined)
  })

  it('does not invent Checkout from pricing prose or a flag that only mentions checkout', async () => {
    await sync({
      pages: [{ url: 'https://shop.example/pricing', title: 'Pricing' }],
      flags: [
        {
          checkId: 'competing-ctas',
          problem: 'Start checkout from pricing before the plans are clear',
          pageUrl: 'https://shop.example/pricing',
        },
      ],
    })

    expect(mocks.siteOutcomeUpsert).not.toHaveBeenCalled()
    expect(mocks.bindingUpsert).not.toHaveBeenCalled()
    expect(mocks.recordSiteLifecycleEvent).not.toHaveBeenCalled()
  })

  it('binds Checkout to the observed product page', async () => {
    await sync({
      pages: [{ url: 'https://shop.example/products/tote', title: 'Tote' }],
    })

    expect(mocks.siteOutcomeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ slug: 'checkout', kind: 'CHECKOUT', inferenceSource: 'browser' }),
      }),
    )
    expect(boundStartUrl()).toBe('https://shop.example/products/tote')
    expect(mocks.recordSiteLifecycleEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'outcome_created',
        idempotencyKey: 'outcome-created:outcome-checkout',
        properties: { kind: 'checkout', inference: 'browser' },
      }),
    )
  })

  it('does not bind a checkout page, including a checkout journey that never bought', async () => {
    await sync({
      pages: [{ url: 'https://shop.example/checkout', title: 'Checkout' }],
      journeyReviews: [
        {
          journeyType: 'checkout',
          startUrl: 'https://shop.example/checkout',
          steps: [
            {
              url: 'https://shop.example/checkout',
              actionType: 'navigate',
              actionDetail: { label: 'checkout' },
              elementDescription: 'Checkout',
            },
          ],
        },
      ],
    })

    expect(mocks.siteOutcomeUpsert).not.toHaveBeenCalled()
    expect(mocks.bindingUpsert).not.toHaveBeenCalled()
  })

  it('binds a connected storefront when that storefront is not itself checkout', async () => {
    mocks.revenuePathFindFirst.mockResolvedValue({ storefrontUrl: 'https://brand.myshopify.com/' })
    await sync({
      pages: [{ url: 'https://shop.example/about', title: 'About' }],
    })

    expect(boundStartUrl()).toBe('https://brand.myshopify.com/')
  })

  it('does not bind a connected storefront that is already a checkout URL', async () => {
    mocks.revenuePathFindFirst.mockResolvedValue({ storefrontUrl: 'https://shop.example/checkout' })
    await sync({
      pages: [{ url: 'https://shop.example/about', title: 'About' }],
    })

    expect(mocks.siteOutcomeUpsert).not.toHaveBeenCalled()
    expect(mocks.bindingUpsert).not.toHaveBeenCalled()
  })

  it('keeps the product page when a cart and a storefront homepage are also present', async () => {
    mocks.revenuePathFindFirst.mockResolvedValue({ storefrontUrl: 'https://shop.example/' })
    await sync({
      pages: [
        { url: 'https://shop.example/cart', title: 'Cart' },
        { url: 'https://shop.example/products/tote', title: 'Tote' },
      ],
    })

    expect(boundStartUrl()).toBe('https://shop.example/products/tote')
  })

  it('binds the page that recorded a buy when the audit has no product URL', async () => {
    await sync({
      pages: [{ url: 'https://shop.example/collections/summer', title: 'Summer' }],
      journeyReviews: [
        {
          journeyType: 'checkout',
          startUrl: 'https://shop.example/collections/summer',
          steps: [
            {
              url: 'https://shop.example/collections/summer',
              actionType: 'click',
              actionDetail: { text: 'Add to cart' },
              elementDescription: null,
            },
          ],
        },
      ],
    })

    expect(boundStartUrl()).toBe('https://shop.example/collections/summer')
  })

  it('does not turn a dead payment link on a pricing page into Checkout', async () => {
    await sync({
      pages: [{ url: 'https://shop.example/pricing', title: 'Pricing' }],
      flags: [{ checkId: 'checkout-link-dead', pageUrl: 'https://shop.example/pricing' }],
    })

    expect(mocks.siteOutcomeUpsert).not.toHaveBeenCalled()
    expect(mocks.bindingUpsert).not.toHaveBeenCalled()
  })

  it('binds the page where a purchase attempt failed when that page is not checkout', async () => {
    await sync({
      pages: [{ url: 'https://shop.example/shop/widget', title: 'Widget' }],
      flags: [
        {
          checkId: 'journey-checkout-failed-add_to_cart_noop',
          pageUrl: 'https://shop.example/shop/widget',
        },
      ],
    })
    expect(boundStartUrl()).toBe('https://shop.example/shop/widget')

    mocks.siteOutcomeUpsert.mockClear()
    mocks.bindingUpsert.mockClear()
    await sync({
      flags: [
        {
          checkId: 'journey-checkout-failed-add_to_cart_noop',
          pageUrl: 'https://shop.example/checkout',
        },
      ],
    })
    expect(mocks.bindingUpsert).not.toHaveBeenCalled()
  })

  it('does not rewrite a Checkout the customer already owns', async () => {
    mocks.siteOutcomeFindUnique.mockResolvedValue({
      inferenceSource: 'user',
      confirmedAt: new Date('2026-10-01T00:00:00.000Z'),
    })
    await sync({
      pages: [{ url: 'https://shop.example/products/tote', title: 'Tote' }],
    })

    expect(mocks.siteOutcomeUpsert).not.toHaveBeenCalled()
    expect(mocks.bindingUpsert).not.toHaveBeenCalled()
    expect(mocks.recordSiteLifecycleEvent).not.toHaveBeenCalled()
  })

  it('ignores a product URL on another host and still binds a storefront on the shop host', async () => {
    await sync({
      pages: [{ url: 'https://other.example/products/tote', title: 'Elsewhere' }],
    })
    expect(mocks.bindingUpsert).not.toHaveBeenCalled()

    mocks.revenuePathFindFirst.mockResolvedValue({ storefrontUrl: 'https://brand.myshopify.com/cart' })
    await sync({
      pages: [{ url: 'https://other.example/products/tote', title: 'Elsewhere' }],
    })
    expect(boundStartUrl()).toBe('https://brand.myshopify.com/cart')
  })

  it('binds a provisional Site product page without recording a project lifecycle event', async () => {
    await sync(
      {
        projectId: null,
        pages: [{ url: 'https://shop.example/products/tote', title: 'Tote' }],
      },
      projectSite({
        siteId: 'p_prov-1',
        kind: 'provisional',
        projectId: null,
        provisionalSiteId: 'prov-1',
        userId: null,
      }),
    )

    expect(mocks.revenuePathFindFirst).not.toHaveBeenCalled()
    expect(boundStartUrl()).toBe('https://shop.example/products/tote')
    expect(mocks.recordSiteLifecycleEvent).not.toHaveBeenCalled()
  })
})
