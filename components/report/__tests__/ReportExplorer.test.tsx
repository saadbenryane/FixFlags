import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReportExplorer } from '@/components/report/ReportExplorer'
import type {
  ExplorerFlag,
  ReportExplorerModel,
} from '@/lib/report/explorer-model'

vi.mock('@/lib/analytics/events', () => ({
  trackEvent: vi.fn(),
}))

function flag(
  id: string,
  title: string,
  hasFixPrompt: boolean
): ExplorerFlag {
  return {
    id,
    checkId: hasFixPrompt ? 'slow-3g-cta-delayed' : null,
    title,
    rubric: 'EXPERIENCE',
    rubricLabel: 'Experience',
    severity: 'IMPORTANT',
    severityLabel: 'Important Flag',
    impactTag: 'CONVERSION',
    whyItMatters: 'Visitors need a usable action.',
    evidence: 'Observed on the tested page.',
    fixPrompt: hasFixPrompt ? 'Render the CTA in the initial HTML.' : '',
    copyFixPrompt: hasFixPrompt ? 'Render the CTA in the initial HTML.' : '',
    toolPrompts: {},
    verificationRule: null,
    evidenceDevices: ['desktop'],
    hasFixPrompt,
    pageUrl: 'https://example.com/',
    pageUrls: ['https://example.com/'],
    occurrenceCount: 1,
    truthLabel: 'Detected',
  }
}

const locked = flag('locked', 'Locked first flag', false)
const demonstrated = flag('demonstrated', 'Demonstrated fix', true)
const model: ReportExplorerModel = {
  displayHost: 'example.com',
  pageType: 'Landing',
  score: 70,
  verdict: null,
  flagCount: 2,
  desktopScreenshot: null,
  mobileScreenshot: null,
  rubricScores: [
    { name: 'MESSAGE', score: 80, grade: 'B' },
    { name: 'EXPERIENCE', score: 70, grade: 'C' },
    { name: 'REACH', score: 90, grade: 'A' },
  ],
  flags: [locked, demonstrated],
  allHighlights: [],
  previewMeta: null,
}

describe('ReportExplorer anonymous teaser', () => {
  it('selects the one visible prompt even when the progressive frame started elsewhere', async () => {
    const { rerender } = render(
      <ReportExplorer model={{ ...model, flags: [locked] }} aiLocked loading />
    )

    rerender(<ReportExplorer model={model} aiLocked />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Experience · Conversion: Demonstrated fix' })
      ).toHaveAttribute('aria-pressed', 'true')
    })
    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeInTheDocument()
    expect(screen.queryByText(/Create a free account to get the fix prompt/i)).not.toBeInTheDocument()
  })
})
