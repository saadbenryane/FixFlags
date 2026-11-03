import { describe, expect, it } from 'vitest'
import { monitoringExecutionCovers } from '../execution-spec'
import type { ExecutionSpec } from '../../domain/execution-spec'

const root = 'https://example.com/', peer = root + 'contact'
const spec: ExecutionSpec = { version: 1, engine: 'progressive-v1', targetUrl: root, scope: 'SITE', environment: 'production',
  monitoringPages: [root, peer], checks: { 'title-missing': 1 }, outcomes: [], verificationTarget: null }

describe('live monitoring compatibility from the existing execution planner', () => {
  it('shares a broader frozen page plan without depending on page position', () => {
    expect(monitoringExecutionCovers({ ...spec, monitoringPages: [root, root + 'pricing', peer] }, spec)).toBe(true)
    expect(monitoringExecutionCovers(spec, { ...spec, monitoringPages: [root] })).toBe(true)
    expect(monitoringExecutionCovers({ ...spec, monitoringPages: [root] }, spec)).toBe(false)
  })
  it('recognizes implicit primary and historical entry behavior instead of requiring identical snapshots', () => {
    const requested = { ...spec, monitoringBehaviors: [{ pageUrl: peer, behaviors: ['flow' as const] }] }
    expect(monitoringExecutionCovers({ ...spec, monitoringEntryPages: [peer] }, requested)).toBe(true)
    expect(monitoringExecutionCovers(spec, requested)).toBe(false)
  })
  it('compares the work the category actually runs rather than unrelated recorded behavior', () => {
    const category: ExecutionSpec = { ...spec, monitoringPages: undefined, scope: 'CATEGORY',
      category: { area: 'search', sourceAuditId: 'inventory', pages: [root, peer] } }
    expect(monitoringExecutionCovers(category, { ...category,
      monitoringBehaviors: [{ pageUrl: peer, behaviors: ['flow', 'journeys'] }] })).toBe(true)
  })
})
