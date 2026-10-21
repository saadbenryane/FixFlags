import { describe, expect, it, vi } from 'vitest'
import { monitoringResponsibility, monitoringBehaviorResponsibility } from '../application/monitoring-responsibility'

describe('monitoring responsibility admission budget', () => {
  it('retains a full compatible cohort without reading history', async () => {
    const root = 'https://example.com/', recorded = Array.from({ length: 23 }, (_, index) => root + 'page-' + index)
    const read = vi.fn().mockRejectedValue(new Error('History is unnecessary'))
    expect(await monitoringResponsibility({ projectId: 'owned', environment: 'production', targetUrl: root, recorded }, { $queryRaw: read }))
      .toEqual([root, ...recorded])
    expect(read).not.toHaveBeenCalled()
  })
  it('does not read role history when every selected page is already an admitted entry', async () => {
    const root = 'https://example.com/', entry = root + 'plans/?team=1#choose'
    const read = vi.fn().mockRejectedValue(new Error('History is unnecessary'))
    expect(await monitoringBehaviorResponsibility({ projectId: 'owned', environment: 'production', pages: [root, entry], recordedEntries: [entry, 'https://foreign.example/'] }, { $queryRaw: read }))
      .toEqual([root, entry].map(pageUrl => ({ pageUrl, behaviors: ['flow', 'pricing-navigation', 'slow-replay', 'journeys'] })))
    expect(read).not.toHaveBeenCalled()
  })
  it('retains current priority, exact request conditions and the existing ceiling across older branches', async () => {
    const root = 'https://example.com/', current = root + 'pricing/?plan=teams/'
    const read = vi.fn().mockResolvedValue(Array.from({ length: 48 }, (_, index) => ({
      url: root + 'retained-' + index, sourceUrl: root, intent: null,
    })))
    const pages = await monitoringResponsibility({ projectId: 'owned', environment: 'production', targetUrl: root, recorded: [current] }, { $queryRaw: read })
    expect(pages).toEqual([root, current, ...Array.from({ length: 22 }, (_, index) => root + 'retained-' + index)])
    expect(read).toHaveBeenCalledTimes(1)
  })
})
