import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReportExplorer } from '@/components/report/ReportExplorer'
import { AGENT_COPY_LEAD } from '@/lib/audit/priority-flags'
import { MeProvider } from '@/hooks/useMe'
import type {
  ExplorerFlag,
  ReportExplorerModel,
} from '@/lib/report/explorer-model'

vi.mock('@/lib/analytics/events', () => ({
  trackEvent: vi.fn(),
}))

const writeText = vi.fn().mockResolvedValue(undefined)
Object.assign(navigator, { clipboard: { writeText } })

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
    copyFixPrompt: hasFixPrompt ? `${AGENT_COPY_LEAD}\n\n1. Render the CTA in the initial HTML.` : '',
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
  flagCount: 2,
  polishPassPrompt: `${AGENT_COPY_LEAD}\n\n1. Render the CTA in the initial HTML.`,
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
          name: /Demonstrated fix/,
        })
      ).toHaveAttribute('aria-pressed', 'true')
    })
    expect(screen.getAllByRole('button', { name: 'Copy prompt' }).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Create a free account to get the fix prompt/i)).not.toBeInTheDocument()
  })

  it('restores a valid selected Flag from the URL', async () => {
    window.history.replaceState({}, '', '/report/a1?flag=locked&rubric=EXPERIENCE')
    render(
      <MeProvider initialUser={null}>
        <ReportExplorer model={model} aiLocked auditId="a1" />
      </MeProvider>
    )
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /Locked first flag/,
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
        <ReportExplorer model={model} aiLocked auditId="a1" />
      </MeProvider>
    )
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /Locked first flag/,
        })
      ).toHaveAttribute('aria-pressed', 'true')
    })
    expect(window.location.search).toContain('flag=locked')
    expect(window.location.search).not.toContain('deleted')
  })

  it('does not write explorer state onto the homepage URL without a live audit id', async () => {
    window.history.replaceState({}, '', '/')
    render(
      <MeProvider initialUser={null}>
        <ReportExplorer model={model} />
      </MeProvider>
    )

    await screen.findByRole('button', { name: /Locked first flag/ })
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('')
  })

  it('reapplies explorer filter state from browser history navigation', async () => {
    const localModel: typeof model = {
      ...model,
      flags: [
        ...model.flags,
        { ...model.flags[0], id: 'demo', title: 'Another issue' },
      ],
    }

    window.history.replaceState({}, '', '/report/a1?flag=locked')
    render(
      <MeProvider initialUser={null}>
        <ReportExplorer model={localModel} auditId="a1" />
      </MeProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Locked first flag/ })).toHaveAttribute('aria-pressed', 'true')
    })

    window.history.replaceState({}, '', '/report/a1?flag=demo')
    window.dispatchEvent(new PopStateEvent('popstate'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Another issue/ })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('moves through the filtered Flag order with bounded detail controls', async () => {
    window.history.replaceState({}, '', '/report/a1?flag=locked')
    render(
      <MeProvider initialUser={null}>
        <ReportExplorer model={model} auditId="a1" />
      </MeProvider>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Locked first flag/ })).toHaveAttribute('aria-pressed', 'true')
    })
    expect(screen.getByRole('button', { name: 'Previous flag' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next flag' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Demonstrated fix/ })).toHaveAttribute('aria-pressed', 'true')
    })
    expect(window.location.search).toContain('flag=demonstrated')
    expect(screen.getByRole('button', { name: 'Next flag' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Previous flag' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Locked first flag/ })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('keeps rubric filters reachable at pane width instead of hiding them on large viewports', async () => {
    const critical: ExplorerFlag = {
      ...locked,
      id: 'critical',
      title: 'Critical flag',
      severity: 'CRITICAL',
      severityLabel: 'Critical Flag',
      impactTag: 'TRUST',
    }
    render(
      <MeProvider initialUser={null}>
        <ReportExplorer model={{ ...model, flags: [critical, demonstrated], flagCount: 2 }} />
      </MeProvider>
    )

    expect((await screen.findAllByText('Experience')).length).toBeGreaterThan(0)
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
    expect(screen.getByText('Not flagged on mobile')).toBeInTheDocument()
  })

  it('copies every ranked open flag from polishPassPrompt, not one CTA', async () => {
    const polishPassPrompt = `${AGENT_COPY_LEAD}

1. [CRITICAL · Experience · HIGH] CTA below fold
   Fix: Move the CTA up.
2. [IMPORTANT · Message · MEDIUM] Generic headline
   Fix: Name the outcome.`
    render(
      <MeProvider initialUser={null}>
        <ReportExplorer
          model={{
            ...model,
            polishPassPrompt,
            flags: [locked, demonstrated],
            flagCount: 2,
          }}
        />
      </MeProvider>
    )

    const copyAll = screen.getByRole('button', { name: /Copy Finish Plan/i })
    fireEvent.click(copyAll)
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled()
    })
    const copied = writeText.mock.calls[0]?.[0] as string
    expect(copied.split('\n', 1)[0]).toBe(AGENT_COPY_LEAD)
    expect(copied).toMatch(/1\. /)
    expect(copied).toMatch(/2\. /)
    expect(copied).toContain('CTA below fold')
    expect(copied).toContain('Generic headline')
  })
})
