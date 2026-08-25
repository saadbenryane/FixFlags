import { describe, expect, it } from 'vitest'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import {
  buildReportWorkspaceModel,
  historyPointFromAudit,
} from '@/lib/report/workspace-model'

function buildExplorer(): ReportExplorerModel {
  return {
    displayHost: 'example.com',
    pageType: 'Landing page',
    score: 70,
    flagCount: 1,
    polishPassPrompt: null,
    desktopScreenshot: null,
    mobileScreenshot: null,
    rubricScores: [],
    flags: [
      {
        id: 'flag-1',
        checkId: 'test-check',
        title: 'The primary action is unclear',
        rubric: 'MESSAGE',
        rubricLabel: 'Message',
        severity: 'CRITICAL',
        severityLabel: 'Critical',
        impactTag: 'CONVERSION',
        whyItMatters: 'Visitors may not know what to do next.',
        evidence: 'The first screen has no primary action.',
        fixPrompt: 'Add one primary action.',
        copyFixPrompt: 'Add one primary action.',
        toolPrompts: {},
        verificationRule: null,
        affectedDevices: ['desktop'],
        hasFixPrompt: true,
        pageUrl: 'https://example.com',
        pageUrls: ['https://example.com'],
        occurrenceCount: 1,
        truthLabel: 'Detected',
      },
    ],
    allHighlights: [],
    previewMeta: null,
  }
}

const lockedCapabilities = {
  promptAccess: 'none' as const,
  canReplayTimeline: false,
  canChat: false,
  canUseCanvas: false,
  canShare: false,
  canExport: false,
  canRecheck: false,
  canGiveFeedback: false,
  demonstratedFlagId: null,
}

describe('report workspace model', () => {
  it('builds summary truth and keeps capabilities off unless explicitly granted', () => {
    const workspace = buildReportWorkspaceModel({
      kind: 'sample',
      explorer: buildExplorer(),
      capabilities: {
        ...lockedCapabilities,
        promptAccess: 'demonstrated',
        demonstratedFlagId: 'flag-1',
      },
    })

    expect(workspace.outcome).toEqual({ unresolvedCount: 1 })
    expect(workspace.capabilities).toMatchObject({
      promptAccess: 'demonstrated',
      canCopyPrompts: true,
      canReplayTimeline: false,
      canChat: false,
      canUseCanvas: false,
      demonstratedFlagId: 'flag-1',
    })
  })

  it('orders persisted history and keeps explicit destinations intact', () => {
    const workspace = buildReportWorkspaceModel({
      kind: 'dashboard',
      explorer: buildExplorer(),
      auditId: 'audit-2',
      capabilities: lockedCapabilities,
      history: [
        {
          id: 'audit-2',
          href: '/report/audit-2?view=report',
          score: 80,
          checkedAt: new Date('2026-07-28T11:00:00Z'),
          kind: 'update-review',
          status: 'completed',
        },
        {
          id: 'audit-1',
          href: '/report/audit-1?view=report',
          score: 60,
          checkedAt: new Date('2026-07-28T10:00:00Z'),
          kind: 'product-review',
          status: 'completed',
        },
      ],
    })

    expect(workspace.summary.history?.map((point) => point.id)).toEqual([
      'audit-1',
      'audit-2',
    ])
    expect(workspace.summary.history?.map((point) => point.href)).toEqual([
      '/report/audit-1?view=report',
      '/report/audit-2?view=report',
    ])
  })

  it('keeps a single observation visible and uses null only for no history', () => {
    const single = buildReportWorkspaceModel({
      kind: 'dashboard',
      explorer: buildExplorer(),
      capabilities: lockedCapabilities,
      history: [
        {
          id: 'audit-1',
          href: '/report/audit-1?view=report',
          score: 60,
          checkedAt: new Date('2026-07-28T10:00:00Z'),
          kind: 'product-review',
          status: 'completed',
        },
      ],
    })
    const empty = buildReportWorkspaceModel({
      kind: 'dashboard',
      explorer: buildExplorer(),
      capabilities: lockedCapabilities,
      history: [],
    })

    expect(single.summary.history?.map((point) => point.id)).toEqual(['audit-1'])
    expect(empty.summary.history).toBeNull()
  })

  it('builds a canonical full-Report destination from an audit row', () => {
    const point = historyPointFromAudit({
      id: 'audit / 1',
      score: 72.5,
      checkedAt: new Date('2026-07-28T10:00:00Z'),
      parentId: 'parent-1',
      recheckTrigger: 'MANUAL',
    })

    expect(point).toMatchObject({
      id: 'audit / 1',
      href: '/report/audit%20%2F%201?view=report',
      kind: 'update-review',
      status: 'completed',
      score: 72.5,
    })
  })

  it('keeps Timeline, chat, Canvas, and prompt access independent', () => {
    const workspace = buildReportWorkspaceModel({
      kind: 'sample',
      explorer: buildExplorer(),
      capabilities: {
        ...lockedCapabilities,
        canReplayTimeline: true,
        canUseCanvas: true,
      },
    })

    expect(workspace.capabilities).toMatchObject({
      promptAccess: 'none',
      canCopyPrompts: false,
      canReplayTimeline: true,
      canChat: false,
      canUseCanvas: true,
    })
  })
})
