import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MeProvider } from '@/hooks/useMe'
import { PLAN_LIMIT_NOTICE } from '@/lib/marketing/copy'

const startScanWithHandoff = vi.hoisted(() => vi.fn())
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
const trackEvent = vi.hoisted(() => vi.fn())
const trackStartedAudit = vi.hoisted(() => vi.fn())
const readOrCreateAnalyticsJourneyId = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/',
  useSearchParams: () => ({ get: () => null }),
}))
vi.mock('@/lib/audit/start-scan-handoff', () => ({
  startScanWithHandoff,
  trackStartedAudit,
}))
vi.mock('@/lib/analytics/events', () => ({ trackEvent }))
vi.mock('@/lib/analytics/journey-id', () => ({ readOrCreateAnalyticsJourneyId }))
vi.mock('@/components/auth/AuthFlow', () => ({
  AuthFlow: ({ dialogTitle }: { dialogTitle?: string }) => <div>{dialogTitle}</div>,
}))

import { AuditInput } from '@/components/audit/AuditInput'

describe('AuditInput scan handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readOrCreateAnalyticsJourneyId.mockReturnValue(null)
  })

  it('hands one consented journey key to the check and exact GA start event', async () => {
    const journeyId = `ffj_${'a'.repeat(32)}`
    readOrCreateAnalyticsJourneyId.mockReturnValue(journeyId)
    startScanWithHandoff.mockImplementation(async (options) => {
      options.onStarted?.({ reportId: 'audit-attributed', reused: false, isLoggedIn: false })
      return { ok: true, siteId: 'site-attributed', reportId: 'audit-attributed' }
    })
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" idSuffix="-attribution" />
      </MeProvider>,
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledOnce())
    expect(startScanWithHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ journeyId }),
      }),
    )
    expect(trackStartedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        journeyId,
        auditId: 'audit-attributed',
        reused: false,
      }),
    )
  })

  it('shows an in-flight submit button while the scan request is pending without report chrome', async () => {
    startScanWithHandoff.mockReturnValue(new Promise(() => {}))
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" idSuffix="-site-handoff" />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)

    expect(await screen.findByRole('button', { name: /Analyzing/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Fix list with/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/Preparing your review/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Opening your report/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Top Flags')).not.toBeInTheDocument()
  })

  it('returns to the URL field after a creation error without submitting again', async () => {
    startScanWithHandoff.mockResolvedValue({
      ok: false,
      message: 'Could not start this check.',
    })
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" idSuffix="-report-error" />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)

    expect(await screen.findByText('Could not start this check.')).toBeInTheDocument()
    const retryButton = screen.getByRole('button', { name: /Analyze/i })
    expect(retryButton).toBeEnabled()
    expect(startScanWithHandoff).toHaveBeenCalledOnce()

    fireEvent.click(retryButton)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledTimes(2))
  })

  it.each([
    ['hero', '-hero-validation'],
    ['final', '-final-validation'],
  ] as const)('validates empty and malformed URLs in the %s form', async (placement, idSuffix) => {
    render(
      <MeProvider initialUser={null}>
        <AuditInput
          variant="landing"
          ctaPlacement={placement}
          idSuffix={idSuffix}
        />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByText('Enter a URL like https://yoursite.com')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'not a url' } })
    fireEvent.submit(input.closest('form')!)
    expect(
      await screen.findByText('Enter a valid URL like https://yoursite.com')
    ).toBeInTheDocument()
    expect(startScanWithHandoff).not.toHaveBeenCalled()
  })

  it('checks the destination host rather than refusing a public URL that mentions localhost in its path', async () => {
    startScanWithHandoff.mockResolvedValue({ ok: true, reportId: 'report-url-validation' })
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" idSuffix="-host-validation" />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'https://example.com/docs/localhost' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledOnce())
    expect(startScanWithHandoff).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com/docs/localhost',
    }))
    expect(screen.queryByText('FixFlags can only check publicly accessible URLs')).not.toBeInTheDocument()
  })

  it('still refuses a local destination host before starting a scan', async () => {
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" idSuffix="-local-host" />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'https://app.localhost/example.com' } })
    fireEvent.submit(input.closest('form')!)

    expect(await screen.findByText('FixFlags can only check publicly accessible URLs')).toBeInTheDocument()
    expect(startScanWithHandoff).not.toHaveBeenCalled()
  })

  it.each([
    ['hero', '-hero-success'],
    ['final', '-final-success'],
  ] as const)('normalizes and hands off a valid URL from the %s form', async (placement, idSuffix) => {
    startScanWithHandoff.mockResolvedValue({
      ok: true,
      reportId: 'report-homepage-qa',
    })
    render(
      <MeProvider initialUser={null}>
        <AuditInput
          variant="landing"
          ctaPlacement={placement}
          idSuffix={idSuffix}
        />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com/' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledOnce())
    expect(startScanWithHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com',
        body: expect.objectContaining({
          url: 'https://example.com',
          source: 'homepage',
        }),
        navigate: expect.any(Function),
      })
    )
  })

  it('opens the scan-limit create-account dialog instead of starting a second anonymous scan', async () => {
    startScanWithHandoff.mockResolvedValue({
      ok: false,
      code: 'AUTH_REQUIRED',
      message: 'Create a free account to continue.',
    })
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" idSuffix="-scan-limit" />
      </MeProvider>
    )

    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)

    expect(
      await screen.findAllByText('Create a free account to continue')
    ).not.toHaveLength(0)
    expect(
      screen.getAllByText(/already used your anonymous Site check/i).length
    ).toBeGreaterThan(0)
  })

  it('hides the sample CTA on the dashboard input', () => {
    render(
      <MeProvider initialUser={{ id: 'u1', email: 'a@b.com', plan: 'FREE' } as never}>
        <AuditInput idSuffix="-dashboard" showLandingExtras={false} />
      </MeProvider>,
    )

    expect(screen.queryByRole('button', { name: /see how it works/i })).not.toBeInTheDocument()
  })

  it('shows the sample CTA on the landing hero', () => {
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" showLandingExtras idSuffix="-hero-sample" />
      </MeProvider>,
    )

    expect(screen.getByRole('button', { name: /see how it works/i })).toBeInTheDocument()
  })

  it('centers the landing submit label and parks the arrow on the right', async () => {
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" showLandingExtras={false} idSuffix="-cta-layout" />
      </MeProvider>,
    )

    const submit = await screen.findByRole('button', { name: /Analyze/i })
    expect(submit.className).toMatch(/grid-cols-\[1fr_auto_1fr\]/)
    expect(submit.querySelector('svg')).not.toBeNull()
    expect(submit.textContent).toMatch(/Analyze/)
  })
})

describe('AuditInput plan limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  async function submitFromDashboard() {
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)
  }

  it('offers the plan-limit notice with a real next step instead of a bare sentence', async () => {
    startScanWithHandoff.mockResolvedValue({
      ok: false,
      status: 402,
      code: 'UPGRADE_REQUIRED',
      action: 'upgrade',
      message: 'Your plan supports 1 Product.',
    })
    render(
      <MeProvider initialUser={{ id: 'u1', email: 'a@b.com', plan: 'FREE' } as never}>
        <AuditInput idSuffix="-plan-limit" />
      </MeProvider>,
    )

    await submitFromDashboard()

    expect(
      await screen.findByText(PLAN_LIMIT_NOTICE.copy['site-limit'].title)
    ).toBeInTheDocument()
    // The API detail is kept, but the explanation and the action are ours.
    expect(screen.getByText('Your plan supports 1 Product.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: PLAN_LIMIT_NOTICE.upgradeCta })).toHaveAttribute(
      'href',
      '/pricing'
    )
    // Not a dead end: the field stays usable so the customer is not stuck.
    expect(screen.getByRole('textbox', { name: 'Website URL' })).toBeEnabled()
  })

  it('distinguishes a spent period allowance from a Site cap in the notice and analytics', async () => {
    startScanWithHandoff.mockResolvedValue({
      ok: false,
      status: 402,
      code: 'TOKEN_LIMIT',
      action: 'buy_credits',
      message: 'You are out of analyses this period.',
    })
    render(
      <MeProvider initialUser={{ id: 'u1', email: 'a@b.com', plan: 'FREE' } as never}>
        <AuditInput idSuffix="-check-limit" />
      </MeProvider>,
    )

    await submitFromDashboard()

    expect(
      await screen.findByText(PLAN_LIMIT_NOTICE.copy['check-limit'].title)
    ).toBeInTheDocument()
    expect(trackEvent).toHaveBeenCalledWith('audit_limit_reached', {
      reason: 'plan_analyses_used',
    })
  })

  it('keeps the create-account dialog and does not show the plan notice for AUTH_REQUIRED', async () => {
    startScanWithHandoff.mockResolvedValue({
      ok: false,
      status: 402,
      code: 'AUTH_REQUIRED',
      action: 'signin',
      message: 'Create a free account to continue.',
    })
    render(
      <MeProvider initialUser={null}>
        <AuditInput idSuffix="-auth-required" />
      </MeProvider>,
    )

    await submitFromDashboard()

    expect(
      (await screen.findAllByText('Create a free account to continue')).length
    ).toBeGreaterThan(0)
    expect(
      screen.queryByText(PLAN_LIMIT_NOTICE.copy['site-limit'].title)
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: PLAN_LIMIT_NOTICE.upgradeCta })).not.toBeInTheDocument()
    // The anonymous teaser reason is unchanged.
    expect(trackEvent).toHaveBeenCalledWith('audit_limit_reached', {
      reason: 'anon_teaser_used',
    })
  })

  it('clears the notice when dismissed so a new attempt starts clean', async () => {
    startScanWithHandoff.mockResolvedValue({
      ok: false,
      status: 402,
      code: 'UPGRADE_REQUIRED',
      action: 'upgrade',
      message: 'Your plan supports 1 Product.',
    })
    render(
      <MeProvider initialUser={{ id: 'u1', email: 'a@b.com', plan: 'FREE' } as never}>
        <AuditInput idSuffix="-plan-dismiss" />
      </MeProvider>,
    )

    await submitFromDashboard()
    fireEvent.click(await screen.findByRole('button', { name: PLAN_LIMIT_NOTICE.dismissCta }))

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: PLAN_LIMIT_NOTICE.upgradeCta })).not.toBeInTheDocument()
    )
  })
})

describe('AuditInput post-signup handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    startScanWithHandoff.mockResolvedValue({ ok: true, siteId: 'site-1' })
  })

  it('resumes the handed-off URL exactly once across a remount', async () => {
    const first = render(
      <MeProvider initialUser={{ id: 'u1', email: 'a@b.com', plan: 'FREE' } as never}>
        <AuditInput idSuffix="-handoff" initialUrl="https://example.com" autoStart />
      </MeProvider>,
    )

    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledTimes(1))
    expect(startScanWithHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com' })
    )

    // The real round trip remounts the page (post-login -> dashboard), so the
    // same URL must not start a second analysis.
    first.unmount()
    render(
      <MeProvider initialUser={{ id: 'u1', email: 'a@b.com', plan: 'FREE' } as never}>
        <AuditInput idSuffix="-handoff-remount" initialUrl="https://example.com" autoStart />
      </MeProvider>,
    )

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Website URL' })).toBeEnabled())
    expect(startScanWithHandoff).toHaveBeenCalledTimes(1)
  })

  it('does not auto-submit when no handoff URL is present', async () => {
    render(
      <MeProvider initialUser={{ id: 'u1', email: 'a@b.com', plan: 'FREE' } as never}>
        <AuditInput idSuffix="-no-handoff" autoStart />
      </MeProvider>,
    )

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Website URL' })).toBeEnabled())
    expect(startScanWithHandoff).not.toHaveBeenCalled()
  })
})
