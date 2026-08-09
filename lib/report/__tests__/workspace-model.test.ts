import { describe, expect, it } from 'vitest'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import {
  buildCuratedSampleWorkspaceModel,
  buildDashboardWorkspaceModel,
} from '@/lib/report/workspace-adapters'

describe('report workspace model', () => {
  it('keeps the complete curated Flag list while exposing one demonstrated prompt', () => {
    const report = buildSampleReportDisplay(getStaticSampleAudit())
    const workspace = buildCuratedSampleWorkspaceModel(report)

    expect(workspace.explorer.flags).toHaveLength(report.flags.length)
    expect(workspace.outcome.unresolvedCount).toBe(report.flags.length)
    expect(workspace.outcome.criticalCount).toBe(1)
    expect(workspace.explorer.flags.filter((flag) => flag.hasFixPrompt)).toHaveLength(1)
    expect(workspace.capabilities.demonstratedFlagId).toBe(report.demonstratedFlagId)
    expect(workspace.summary.history).toHaveLength(5)
    // History is null when there are fewer than 2 points
    const noHistory = buildCuratedSampleWorkspaceModel(
      buildSampleReportDisplay({ ...getStaticSampleAudit(), scoreHistory: undefined })
    )
    expect(noHistory.summary.history).toBeNull()
  })

  it('orders persisted history and keeps single observations visible', () => {
    const sample = buildCuratedSampleWorkspaceModel(
      buildSampleReportDisplay(getStaticSampleAudit())
    )

    const single = buildDashboardWorkspaceModel({
      explorer: sample.explorer,
      auditId: 'audit-1',
      url: 'https://example.com',
      checkedAt: new Date('2026-07-28T10:00:00Z'),
      history: [
        {
          id: 'audit-1',
          score: 60,
          checkedAt: new Date('2026-07-28T10:00:00Z'),
          kind: 'product-review',
          status: 'completed',
        },
      ],
    })
    // A first observation still renders as one spine bar; nothing is hidden.
    expect(single.summary.history?.map((point) => point.id)).toEqual(['audit-1'])

    const multiple = buildDashboardWorkspaceModel({
      explorer: sample.explorer,
      auditId: 'audit-2',
      url: 'https://example.com',
      checkedAt: new Date('2026-07-28T11:00:00Z'),
      history: [
        {
          id: 'audit-2',
          score: 80,
          checkedAt: new Date('2026-07-28T11:00:00Z'),
          kind: 'update-review',
          status: 'completed',
        },
        {
          id: 'audit-1',
          score: 60,
          checkedAt: new Date('2026-07-28T10:00:00Z'),
          kind: 'product-review',
          status: 'completed',
        },
      ],
    })
    expect(multiple.summary.history?.map((point) => point.id)).toEqual([
      'audit-1',
      'audit-2',
    ])
  })
})
