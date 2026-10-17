import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ browser: {}, tree: vi.fn(), links: vi.fn(), plan: vi.fn(),
  open: vi.fn(), dispose: vi.fn(), close: vi.fn(), title: vi.fn(), evaluate: vi.fn() }))
vi.mock('@/lib/audit/screenshot', () => ({ getAuditBrowser: async () => fixture.browser }))
vi.mock('@/lib/audit/browser/journey-safety', () => ({ captureAccessibilityTree: fixture.tree }))
vi.mock('@/lib/audit/browser/page-session', () => ({ createAuditPage: fixture.open }))
vi.mock('../discover', () => ({ discoverJourneyLinks: fixture.links }))
vi.mock('../planner', () => ({ planJourney: fixture.plan }))
import { observeJourneyPlan } from '../plan-observation'

beforeEach(() => {
  vi.resetAllMocks()
  fixture.tree.mockResolvedValue('Recorded accessibility tree')
  fixture.links.mockResolvedValue([{ href: 'https://example.test/pricing', text: 'Pricing' }])
  fixture.title.mockResolvedValue('Recorded title')
  fixture.evaluate.mockResolvedValueOnce('Recorded description').mockResolvedValueOnce(['Recorded heading'])
  fixture.close.mockResolvedValue(undefined)
  fixture.open.mockResolvedValue({ page: { title: fixture.title, evaluate: fixture.evaluate,
    context: () => ({ close: fixture.close }) }, disposeNetwork: fixture.dispose })
})
describe('journey planner collection lifetime', () => {
  it('uses actual collected facts and the remaining budget after collection, then releases the context', async () => {
    const response = { plan: { goal: 'Follow the observed path' }, usage: { inputTokens: 10 } }
    fixture.plan.mockResolvedValue(response)
    const budget = vi.fn(() => { expect(fixture.evaluate).toHaveBeenCalledTimes(2); return 1200 })
    expect(await observeJourneyPlan('https://example.test/', null, undefined, budget)).toEqual(response)
    expect(fixture.plan).toHaveBeenCalledWith(expect.objectContaining({ initialTree: 'Recorded accessibility tree',
      metadata: { title: 'Recorded title', description: 'Recorded description', h1s: ['Recorded heading'] },
      links: [{ href: 'https://example.test/pricing', text: 'Pricing' }] }), 1200)
    expect(fixture.dispose).toHaveBeenCalledOnce()
    expect(fixture.close).toHaveBeenCalledOnce()
  })
  it('propagates collection failure while releasing its actual context and without calling the provider', async () => {
    fixture.tree.mockRejectedValue(new Error('Controlled collection interrupted'))
    await expect(observeJourneyPlan('https://example.test/', null, undefined, () => 1200)).rejects.toThrow('Controlled collection interrupted')
    expect(fixture.plan).not.toHaveBeenCalled()
    expect(fixture.dispose).toHaveBeenCalledOnce()
    expect(fixture.close).toHaveBeenCalledOnce()
  })
})
