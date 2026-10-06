import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runFindFirst: vi.fn(),
  runUpdateMany: vi.fn(),
  journeyFindFirst: vi.fn(),
  executionFindUnique: vi.fn(),
  executionUpsert: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptCreateMany: vi.fn(),
  attemptUpdateMany: vi.fn(),
  persistJourneyResult: vi.fn(),
  flagUpdateMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    runRequest: {
      findFirst: mocks.runFindFirst,
      updateMany: mocks.runUpdateMany,
    },
    journeyReview: { findFirst: mocks.journeyFindFirst },
    flag: { updateMany: mocks.flagUpdateMany },
    outcomeBindingExecution: {
      findUnique: mocks.executionFindUnique,
      upsert: mocks.executionUpsert,
    },
    outcomeBindingAttempt: {
      findFirst: mocks.attemptFindFirst,
      createMany: mocks.attemptCreateMany,
      updateMany: mocks.attemptUpdateMany,
    },
  },
}))
vi.mock('@/lib/audit/journey/run-journey-reviews', () => ({
  persistJourneyResult: mocks.persistJourneyResult,
}))

import { closeBrowser } from '@/lib/audit/screenshot'
import { runBoundCheckoutForAudit } from '@/lib/sites/application/checkout-execution'

const FIXTURES = path.join(process.cwd(), 'lib/integrity/__tests__/fixtures')
const TERMINAL_URL = /payment|thank-you|thank_you|order-complete|order_complete|complete-order|order-confirmation/i

describe('unmocked Checkout purchase probe', () => {
  let origin: string
  let closeServer: () => Promise<void>
  const previousFixture = process.env.FIXFLAGS_CHECKOUT_FIXTURE

  beforeAll(async () => {
    process.env.FIXFLAGS_CHECKOUT_FIXTURE = '1'
    const started = await listenFixtures()
    origin = started.origin
    closeServer = started.close
  })

  afterAll(async () => {
    if (previousFixture === undefined) delete process.env.FIXFLAGS_CHECKOUT_FIXTURE
    else process.env.FIXFLAGS_CHECKOUT_FIXTURE = previousFixture
    await closeServer?.()
    await closeBrowser()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.journeyFindFirst.mockResolvedValue(null)
    mocks.executionFindUnique.mockResolvedValue(null)
    mocks.executionUpsert.mockResolvedValue({ id: 'execution-1' })
    mocks.attemptFindFirst.mockResolvedValue(null)
    mocks.attemptCreateMany.mockResolvedValue({ count: 1 })
    mocks.attemptUpdateMany.mockResolvedValue({ count: 0 })
    mocks.runUpdateMany.mockResolvedValue({ count: 1 })
    mocks.persistJourneyResult.mockResolvedValue([])
    mocks.flagUpdateMany.mockResolvedValue({ count: 0 })
  })

  it('records success only after the buy control reaches checkout', async () => {
    mockCheckoutRun(`${origin}/green/`)

    await expect(runBoundCheckoutForAudit('audit-1')).resolves.toBe(true)

    const journey = lastJourney()
    const checkoutStep = journey.steps.find((step) => step.actionType === 'checkout' || /\/checkout(?:\/|$|\?)/.test(step.url))
    expect(journey.goalAchieved).toBe(true)
    expect(journey.steps.some((step) => step.actionType === 'add_to_cart')).toBe(true)
    expect(checkoutStep?.url.startsWith(origin)).toBe(true)
    expect(checkoutStep?.url).toMatch(/\/checkout(?:\/|$|\?)/)
    expect(checkoutStep?.url).not.toMatch(TERMINAL_URL)
    expect(journey.findings).toEqual([])
    expect(lastDisposition()).toBe('SUCCEEDED')
  }, 120_000)

  it('records a confirmed purchase failure when add to cart does nothing', async () => {
    mockCheckoutRun(`${origin}/red-atc/`)

    await runBoundCheckoutForAudit('audit-1')

    const journey = lastJourney()
    expect(journey.goalAchieved).toBe(false)
    expect(journey.findings).toEqual([
      expect.objectContaining({ checkId: 'journey-checkout-failed-add_to_cart_noop' }),
    ])
    expect(journey.steps.some((step) => step.url.startsWith(`${origin}/red-atc`))).toBe(true)
    expect(lastDisposition()).toBe('FAILED')
    expect(mocks.flagUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { fingerprint: 'outcome:checkout' },
    }))
  }, 120_000)

  it('records neither success nor a confirmed failure when the page has no buy control', async () => {
    mockCheckoutRun(`${origin}/unknown/`)

    await runBoundCheckoutForAudit('audit-1')

    const journey = lastJourney()
    expect(journey.goalAchieved).toBe(false)
    expect(journey.findings).toEqual([])
    expect(journey.steps.some((step) => step.url.startsWith(`${origin}/unknown`))).toBe(true)
    expect(lastDisposition()).toBe('BLOCKED')
    expect(mocks.flagUpdateMany).not.toHaveBeenCalled()
  }, 120_000)

  it('does not record success when the start URL is already checkout', async () => {
    mockCheckoutRun(`${origin}/checkout`)

    await runBoundCheckoutForAudit('audit-1')

    const journey = lastJourney()
    expect(journey.goalAchieved).toBe(false)
    expect(journey.findings).toEqual([])
    expect(journey.steps.some((step) => step.actionType === 'add_to_cart')).toBe(false)
    expect(journey.steps.some((step) => step.url.startsWith(origin))).toBe(true)
    expect(lastDisposition()).not.toBe('SUCCEEDED')
    expect(lastDisposition()).not.toBe('FAILED')
  }, 120_000)

  it('does not copy a goal-achieved review that never bought', async () => {
    mockCheckoutRun(`${origin}/unknown/`)
    mocks.journeyFindFirst.mockResolvedValue({
      goalAchieved: true,
      blockedReason: null,
      steps: [
        { actionType: 'navigate', actionDetail: { label: 'landing' }, url: `${origin}/checkout` },
        { actionType: 'checkout', actionDetail: { label: 'checkout' }, url: `${origin}/checkout` },
      ],
    })

    await runBoundCheckoutForAudit('audit-1')

    const journey = lastJourney()
    expect(journey.goalAchieved).toBe(false)
    expect(journey.findings).toEqual([])
    expect(journey.steps.some((step) => step.url.startsWith(`${origin}/unknown`))).toBe(true)
    expect(mocks.executionUpsert.mock.calls.some((call) => call[0]?.create?.disposition === 'SUCCEEDED')).toBe(false)
  }, 120_000)
})

function mockCheckoutRun(startUrl: string) {
  mocks.runFindFirst.mockResolvedValue({
    id: 'run-1',
    selections: [{
      outcome: {
        id: 'outcome-1',
        kind: 'CHECKOUT',
        bindings: [{
          key: 'checkout-browser-v1',
          mechanism: 'BROWSER_JOURNEY',
          required: true,
          config: {
            startUrl,
            steps: [{ action: 'wait', waitMs: 1_000 }],
            goal: { type: 'url_pattern', pattern: '/checkouts?(/|$|\\?)', description: 'Reach the checkout page' },
            safety: 'stop-at-checkout',
            allowLocalhost: false,
          },
        }],
      },
    }],
    audit: { url: startUrl },
  })
}

function lastJourney(): {
  goalAchieved: boolean
  findings: Array<{ checkId?: string }>
  steps: Array<{ actionType: string; url: string }>
} {
  const call = mocks.persistJourneyResult.mock.calls.at(-1)
  expect(call).toBeTruthy()
  return call![1]
}

function lastDisposition(): string {
  const call = mocks.executionUpsert.mock.calls.at(-1)
  expect(call).toBeTruthy()
  return call![0].create.disposition
}

async function listenFixtures(): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    void serveFixture(request, response)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fixture server missing port')
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    }),
  }
}

async function serveFixture(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const raw = (request.url ?? '/').split('?')[0]
  let relative = decodeURIComponent(raw).replace(/^\//, '')
  if (raw === '/checkout' || raw === '/checkout/') relative = 'green/checkout.html'
  else if (relative.endsWith('/')) relative += 'index.html'
  else if (relative.endsWith('/checkout') || relative === 'green/checkout') relative = 'green/checkout.html'
  const filePath = path.join(FIXTURES, relative)
  try {
    const body = await fs.readFile(filePath)
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(body)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' })
    response.end('not found')
  }
}
