import { describe, expect, it } from 'vitest'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { buildSampleExplorerModel } from '@/lib/report/explorer-model'
import { buildCuratedSampleWorkspaceModel } from '@/lib/report/workspace-adapters'
import { buildReportWorkspaceModel } from '@/lib/report/workspace-model'

function contentSignature(model: ReturnType<typeof buildReportWorkspaceModel>) {
  return {
    score: model.summary.score,
    flagOrder: model.explorer.flags.map((flag) => flag.id),
    filters: model.summary.rubrics.map((rubric) => ({
      name: rubric.name,
      flagCount: rubric.flagCount,
    })),
    evidence: model.explorer.flags.map((flag) => ({
      id: flag.id,
      devices: flag.affectedDevices,
      highlights: model.explorer.allHighlights.filter(
        (highlight) => highlight.flagId === flag.id,
      ),
    })),
    captures: [model.explorer.desktopScreenshot, model.explorer.mobileScreenshot],
  }
}

describe('Report workspace adapters', () => {
  it('keeps Report content identical while access capabilities vary by surface', () => {
    const report = buildSampleReportDisplay(getStaticSampleAudit())
    const explorer = buildSampleExplorerModel(report, { promptAccess: 'one' })
    const sample = buildCuratedSampleWorkspaceModel(report)
    const variants = [
      buildReportWorkspaceModel({
        kind: 'completed',
        explorer,
        auditId: report.id,
        capabilities: {
          canReplayTimeline: true,
          canChat: true,
          canUseCanvas: true,
          canShare: true,
          canRecheck: true,
          canGiveFeedback: true,
          promptAccess: 'demonstrated',
          demonstratedFlagId: report.demonstratedFlagId,
        },
      }),
      buildReportWorkspaceModel({
        kind: 'progressive',
        explorer,
        auditId: report.id,
        loading: true,
        capabilities: {
          canReplayTimeline: true,
          canChat: true,
          canUseCanvas: false,
          canShare: false,
          canRecheck: false,
          canGiveFeedback: false,
          promptAccess: 'demonstrated',
          demonstratedFlagId: report.demonstratedFlagId,
        },
      }),
      buildReportWorkspaceModel({
        kind: 'completed',
        explorer,
        auditId: report.id,
        capabilities: {
          canReplayTimeline: false,
          canChat: false,
          canUseCanvas: false,
          canShare: false,
          canRecheck: false,
          canGiveFeedback: false,
          promptAccess: 'demonstrated',
          demonstratedFlagId: report.demonstratedFlagId,
        },
      }),
      sample,
    ]

    for (const variant of variants) {
      expect(contentSignature(variant)).toEqual(contentSignature(sample))
    }
    expect(sample.capabilities).toMatchObject({
      canReplayTimeline: true,
      canChat: false,
      canUseCanvas: false,
      canShare: false,
      canRecheck: true,
      canGiveFeedback: false,
      promptAccess: 'demonstrated',
      demonstratedFlagId: report.demonstratedFlagId,
    })
    expect(variants[2]?.capabilities).toMatchObject({
      canReplayTimeline: false,
      canChat: false,
      canUseCanvas: false,
    })
  })
})
