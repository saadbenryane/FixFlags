import { describe, expect, it } from 'vitest'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { buildSampleExplorerModel } from '@/lib/report/explorer-model'
import {
  buildForbiddenReviewWorkspaceProjection,
  buildReviewWorkspaceProjection,
} from '@/lib/report/review-workspace-projection'

const report = buildSampleReportDisplay(getStaticSampleAudit())
const explorer = buildSampleExplorerModel(report, { promptAccess: 'none' })

describe('ReviewWorkspaceProjection', () => {
  it.each(['running', 'completed', 'partial', 'failed'] as const)(
    'uses the same workspace hierarchy for %s Reviews',
    (kind) => {
      const projection = buildReviewWorkspaceProjection({
        kind,
        explorer,
        visibility: 'public_viewer',
        isAuthenticated: false,
        reviewId: 'review-1',
        url: report.url,
      })

      expect(projection.workspace.identity.auditId).toBe('review-1')
      expect(projection.workspace.explorer).toBe(projection.explorer)
      expect(projection.workspace.capabilities.canCopyPrompts).toBe(false)
      expect(projection.capabilities.canViewEvidence).toBe(true)
    }
  )

  it('redacts live public operations while preserving deterministic messages', () => {
    const projection = buildReviewWorkspaceProjection({
      kind: 'completed',
      explorer,
      visibility: 'anonymous_teaser',
      isAuthenticated: false,
      agentMessages: [{
        id: 'scan:1',
        sessionId: 'scan:review-1',
        role: 'agent',
        source: 'scan',
        kind: 'progress',
        content: 'Checks finished.',
        createdAt: new Date(0).toISOString(),
      }],
    })

    expect(projection.agentMessages).toHaveLength(1)
    expect(projection.capabilities.canViewPromptBodies).toBe(false)
    expect(projection.workspace.capabilities.canChat).toBe(false)
  })

  it('keeps curated samples explicit and non-interactive', () => {
    const projection = buildReviewWorkspaceProjection({
      kind: 'sample',
      explorer: buildSampleExplorerModel(report, { promptAccess: 'one' }),
      visibility: 'curated_sample',
      isAuthenticated: false,
      demonstratedFlagId: report.demonstratedFlagId,
    })

    expect(projection.workspace.capabilities).toMatchObject({
      promptAccess: 'demonstrated',
      canChat: false,
      demonstratedFlagId: report.demonstratedFlagId,
    })
  })

  it('fails closed for forbidden Reviews', () => {
    expect(buildForbiddenReviewWorkspaceProjection()).toMatchObject({
      kind: 'forbidden',
      capabilities: { canViewEvidence: false },
    })
  })
})
