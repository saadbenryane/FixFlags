import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReportExplorer } from '@/components/report/ReportExplorer'
import { MeProvider } from '@/hooks/useMe'
import type {
  ExplorerFlag,
  ReportExplorerModel,
} from '@/lib/report/explorer-model'

vi.mock('@/lib/analytics/events', () => ({
  trackEvent: vi.fn(),
}))

vi.mock('@/components/audit/FixPromptBlock', () => ({
  FixPromptBlock: ({ prompt }: { prompt: string }) => {
    if (!prompt) return null
    return (
      <div data-testid="fix-prompt" role="region">
        <code>{prompt}</code>
        <button>Copy prompt</button>
      </div>
    )
  },
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
    affectedDevices: ['desktop'],
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

afterEach(() => {
  window.history.replaceState({}, '', '/')
})

describe('ReportExplorer anonymous teaser', () => {
  it('selects the one visible prompt even when the progressive frame started elsewhere', async () => {
    const { rerender } = render(
      <MeProvider initialUser={null}>
        <ReportExplorer model={{ ...model, flags: [locked] }} aiLocked loading />
      </MeProvider>
    )

    rerender(
      <MeProvider initialUser={null}>
        <ReportExplorer model={model} aiLocked />
      </MeProvider>
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Important Flag · Experience · Conversion: Demonstrated fix',
        })
      ).toHaveAttribute('aria-pressed', 'true')
    })
    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeInTheDocument()
    expect(screen.queryByText(/Create a free account to get the fix prompt/i)).not.toBeInTheDocument()
  })

  it('restores a valid selected Flag from the URL', async () => {
    window.history.replaceState({}, '', '/report/a1?flag=locked&rubric=EXPERIENCE')
    render(
      <MeProvider initialUser={null}>
        <ReportExplorer model={model} aiLocked />
      </MeProvider>
    )
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Important Flag · Experience · Conversion: Locked first flag',
        })
      ).toHaveAttribute('aria-pressed', 'true')
    })
    expect(window.location.search).toContain('flag=locked')
    expect(window.location.search).toContain('rubric=EXPERIENCE')
  })

  it('normalizes a stale selected Flag to the first ranked visible Flag', async () => {
    window.history.replaceState({}, '', '/report/a1?flag=deleted')
    render(
      <MeProvider initialUser={null}>
        <ReportExplorer model={model} aiLocked />
      </MeProvider>
    )
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Important Flag · Experience · Conversion: Locked first flag',
        })
      ).toHaveAttribute('aria-pressed', 'true')
    })
    expect(window.location.search).toContain('flag=locked')
    expect(window.location.search).not.toContain('deleted')
  })

  it('marks affected and unaffected captures without treating missing captures as healthy', async () => {
    render(
      <MeProvider initialUser={null}>
        <ReportExplorer
          model={{
            ...model,
            flags: [locked],
            flagCount: 1,
            desktopScreenshot: '/desktop.png',
            mobileScreenshot: '/mobile.png',
          }}
        />
      </MeProvider>
    )

    expect(await screen.findByText('Flagged on desktop')).toBeInTheDocument()
    expect(screen.getByText('Not detected for this Flag')).toBeInTheDocument()
  })
})
