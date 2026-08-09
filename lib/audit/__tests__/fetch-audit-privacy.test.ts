import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/auth', () => ({ auth: {} }))

import { redactCompletedPrivateReportData } from '@/lib/audit/fetch-audit'

const privateData = {
  project: { id: 'project-1', productIntelligence: { secret: true } },
  pages: [{ id: 'page-1' }],
  journeyReviews: [{ id: 'journey-1' }],
  pipelineLog: [{ error: 'provider detail', detail: 'internal URL' }],
  watchInterval: 'daily',
  triageAt: new Date('2026-08-09T00:00:00Z'),
  flowData: { steps: ['private'] },
  actionTimeline: [{ label: 'Opened private page' }],
  productContract: { purpose: 'private' },
}

describe('completed report private projection', () => {
  it('removes private replay, memory, pipeline, and watch data for anonymous access', () => {
    expect(redactCompletedPrivateReportData(privateData, false)).toEqual({
      project: null,
      pages: [],
      journeyReviews: [],
      pipelineLog: [],
      watchInterval: null,
      triageAt: null,
      flowData: null,
      actionTimeline: [],
      productContract: null,
    })
  })

  it('preserves owner data', () => {
    expect(redactCompletedPrivateReportData(privateData, true)).toBe(privateData)
  })
})
