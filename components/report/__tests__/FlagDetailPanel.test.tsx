import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FlagDetailPanel, FlagMetaPills, isShareableCheck } from '@/components/report/FlagDetailPanel'
import { MeProvider } from '@/hooks/useMe'
import type { ExplorerFlag } from '@/lib/report/explorer-model'
import type { ReactNode } from 'react'

const LABEL_MAP: Record<string, string> = {
  CRITICAL: 'Critical Flag',
  IMPORTANT: 'Important Flag',
  POLISH: 'Polish Flag',
}

function renderWithProviders(ui: ReactNode) {
  return render(<MeProvider initialUser={null}>{ui}</MeProvider>)
}

function makeFlag(overrides: Partial<ExplorerFlag> = {}): ExplorerFlag {
  const severity = overrides.severity ?? 'CRITICAL'
  return {
    id: 'flag-1',
    title: 'Missing Open Graph image',
    evidence: '',
    whyItMatters: 'Social previews affect click-through rates.',
    copyFixPrompt: '',
    verificationRule: null,
    occurrenceCount: 1,
    pageUrl: null,
    truthLabel: 'Detected',
    severity,
    severityLabel: LABEL_MAP[severity] ?? severity,
    rubric: 'REACH',
    rubricLabel: 'Reach',
    checkId: 'og-image-missing',
    impactTag: 'conversion',
    hasFixPrompt: true,
    fixPrompt: 'Add an Open Graph image meta tag.',
    toolPrompts: {},
    affectedDevices: ['desktop', 'mobile'],
    pageUrls: ['https://example.com/page'],
    ...overrides,
  }
}

describe('FlagDetailPanel', () => {
  it('renders the fix prompt when flag has one', () => {
    renderWithProviders(<FlagDetailPanel flag={makeFlag()} />)
    expect(screen.getByText('Add an Open Graph image meta tag.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ready to verify' })).not.toBeInTheDocument()
  })

  it('enables owner lifecycle actions only with explicit owner report context', () => {
    renderWithProviders(
      <FlagDetailPanel
        flag={makeFlag()}
        ownerActionContext={{
          auditId: 'audit-1',
          surface: 'focused',
          accessState: 'owner',
        }}
      />
    )

    expect(screen.getByRole('button', { name: 'Ready to verify' })).toBeInTheDocument()
  })


  it('offers a copyable agent plan prompt on a Message flag', () => {
    renderWithProviders(
      <FlagDetailPanel
        flag={makeFlag({
          rubric: 'MESSAGE',
          hasFixPrompt: false,
          fixPrompt: '',
          copyFixPrompt:
            'Make a plan to fix these issues, then implement them in this product.\n\n1. [IMPORTANT · Message · HIGH] Generic headline',
        })}
      />
    )
    expect(screen.getByRole('button', { name: /copy prompt/i })).toBeInTheDocument()
  })

  it('shows locked teaser when aiLocked', () => {
    renderWithProviders(<FlagDetailPanel flag={makeFlag()} aiLocked />)
    expect(screen.getByText(/Create a free account/i)).toBeInTheDocument()
  })

  it('shows generating text when aiEnhancementPending and no fixPrompt', () => {
    renderWithProviders(
      <FlagDetailPanel
        flag={makeFlag({ hasFixPrompt: true, fixPrompt: '' })}
        aiEnhancementPending
      />
    )
    expect(screen.getByText('Generating enhanced fix prompt.')).toBeInTheDocument()
  })

  it('renders shareable social preview for og checks with previewMeta', () => {
    renderWithProviders(
      <FlagDetailPanel
        flag={makeFlag({ checkId: 'og-image-missing' })}
        previewMeta={{
          url: 'https://example.com',
          title: null,
          description: 'Example Description',
          ogTitle: null,
          ogDescription: null,
          ogImage: null,
          ogImageOk: false,
        }}
      />
    )
    expect(screen.getByText('Missing title')).toBeInTheDocument()
  })

  it('renders FlagFeedback when showFeedback is true', () => {
    renderWithProviders(<FlagDetailPanel flag={makeFlag()} showFeedback />)
  })

  it('does not render shareable preview for non-shareable checks', () => {
    renderWithProviders(
      <FlagDetailPanel
        flag={makeFlag({ checkId: 'title-missing' })}
        previewMeta={{
          url: 'https://example.com',
          title: null,
          description: 'Desc',
          ogTitle: null,
          ogDescription: null,
          ogImage: null,
          ogImageOk: false,
        }}
      />
    )
    expect(screen.queryByText('Missing title')).not.toBeInTheDocument()
  })

  it('renders page URLs with external links', () => {
    renderWithProviders(<FlagDetailPanel flag={makeFlag()} />)
    const links = screen.getAllByRole('link')
    expect(links.some((l) => l.getAttribute('href') === 'https://example.com/page')).toBe(true)
  })

  it('renders replay step link that drives the workspace playback strip', () => {
    renderWithProviders(
      <FlagDetailPanel
        flag={makeFlag({ evidence: 'Reproduced at step 3: signup' })}
      />
    )
    const link = screen.getByText(/replay step 3/i)
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '?step=3#report-flags')
  })
})

describe('FlagMetaPills', () => {
  it('renders severity signal and rubric pill', () => {
    render(<FlagMetaPills flag={makeFlag()} />)
    expect(screen.getByText('Reach')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Critical Flag' })).toBeInTheDocument()
  })

  it('renders severity label text for non-CRITICAL flags', () => {
    render(<FlagMetaPills flag={makeFlag({ severity: 'IMPORTANT' })} />)
    expect(screen.getByText('Important Flag')).toBeInTheDocument()
  })

  it('renders impact tag when present', () => {
    render(<FlagMetaPills flag={makeFlag({ impactTag: 'CONVERSION' })} />)
    expect(screen.getByText('Conversion')).toBeInTheDocument()
  })

  it('does not render severity label text for CRITICAL flags', () => {
    render(<FlagMetaPills flag={makeFlag({ severity: 'CRITICAL' })} />)
    expect(screen.queryByText('Critical Flag')).not.toBeInTheDocument()
  })
})

describe('isShareableCheck', () => {
  it('returns true for og-image-missing', () => {
    expect(isShareableCheck('og-image-missing')).toBe(true)
  })

  it('returns true for og-title-missing', () => {
    expect(isShareableCheck('og-title-missing')).toBe(true)
  })

  it('returns false for unrelated check IDs', () => {
    expect(isShareableCheck('title-missing')).toBe(false)
  })

  it('returns false for null or undefined', () => {
    expect(isShareableCheck(null)).toBe(false)
    expect(isShareableCheck(undefined)).toBe(false)
  })
})
