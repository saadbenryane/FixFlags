import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { MeProvider, useMe, type MeUser } from '@/hooks/useMe'
import { PLAN_LIMIT_NOTICE } from '@/lib/marketing/copy-barrel'
import { AUDIT_ERRORS } from '@/lib/marketing/copy/errors'

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

function account(id: string): MeUser {
  return { id, email: `${id}@example.invalid`, name: null, plan: 'FREE', role: 'user', isAdmin: false,
    checks: { used: 0, pending: 0, limit: 3, isUnlimited: false, remaining: 3,
      periodStart: '2026-11-01T00:00:00Z', periodEnd: '2026-12-01T00:00:00Z' },
    entitlements: { canExportSummary: true, canAccessPaidFeatures: false, canMonitor: true, canWatchProduct: true },
    vibecodingLevel: null, preferredTools: [] }
}

function RefreshAccount() {
  const { refresh } = useMe()
  return <button onClick={() => void refresh()}>Refresh account</button>
}

describe('AuditInput scan handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', '/')
    readOrCreateAnalyticsJourneyId.mockReturnValue(null)
  })

  it.each(['default', 'landing'] as const)('focuses an invalid website address after submitting the %s form', variant => {
    render(<MeProvider initialUser={null}><AuditInput variant={variant} source="dashboard" /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    fireEvent.change(input, { target: { value: 'ftp://example.com' } })
    const form = input.closest('form')!
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    button.focus()
    fireEvent.submit(form)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveFocus()
    expect(startScanWithHandoff).not.toHaveBeenCalled()
  })

  it.each([
    { kind: 'url', origin: 'button' },
    { kind: 'request', origin: 'input' },
    { kind: 'request', origin: 'button' },
  ])('restores the appropriate control after a $kind failure from the $origin', async ({ kind, origin }) => {
    let finish!: (result: unknown) => void
    startScanWithHandoff.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render(<MeProvider initialUser={null}><AuditInput source="dashboard" /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    fireEvent.change(input, { target: { value: 'example.com/pricing' } })
    const form = input.closest('form')!
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!
    const control = origin === 'input' ? input : button
    control.focus()
    fireEvent.submit(form)
    expect(input).toBeDisabled()
    // JSDOM retains disabled focus. Emulate the browser moving it to the body.
    document.body.setAttribute('tabindex', '-1')
    document.body.focus()
    document.body.removeAttribute('tabindex')
    expect(document.activeElement).toBe(document.body)
    await act(async () => { finish(kind === 'url'
      ? { ok: false, status: 400, code: 'INVALID_URL', message: 'Check this website address.' }
      : { ok: false, status: 503, message: 'Try this check again.' }) })
    expect(screen.getByRole('alert')).toBeVisible()
    expect(kind === 'url' ? input : control).toHaveFocus()
    expect(input).toHaveValue('https://example.com/pricing')
    expect(input).toHaveAttribute('aria-invalid', String(kind === 'url'))
  })

  it('preserves deliberate focus outside the form when a pending submission fails', async () => {
    let finish!: (result: unknown) => void
    startScanWithHandoff.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render(<MeProvider initialUser={null}><AuditInput source="dashboard" /><button>Read saved websites</button></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    fireEvent.change(input, { target: { value: 'example.com' } })
    input.focus()
    fireEvent.submit(input.closest('form')!)
    const other = screen.getByRole('button', { name: 'Read saved websites' })
    other.focus()
    await act(async () => { finish({ ok: false, status: 400, code: 'INVALID_URL', message: 'Check this website address.' }) })
    expect(screen.getByRole('alert')).toBeVisible()
    expect(other).toHaveFocus()
  })

  it('keeps automatic startup failure from taking focus from other content', async () => {
    startScanWithHandoff.mockResolvedValueOnce({ ok: false, message: 'Automatic check needs retry.' })
    render(<MeProvider initialUser={null}><AuditInput source="dashboard" initialUrl="https://focus.fixture.test/" autoStart /><button>Read saved websites</button></MeProvider>)
    const other = screen.getByRole('button', { name: 'Read saved websites' })
    other.focus()
    expect(await screen.findByRole('alert')).toHaveTextContent('Automatic check needs retry.')
    expect(other).toHaveFocus()
    sessionStorage.removeItem('ff:autostart-url:null')
  })

  it('retires the earlier account’s pending submission and permits a fresh submission with the retained URL', async () => {
    let finish!: (result: { ok: false; code: string; message: string }) => void
    startScanWithHandoff.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockImplementationOnce(async options => { options.navigate('/sites/second-account'); return { ok: true, siteId: 'second-account' } })
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ user: account('owner-b') })))
    render(<MeProvider initialUser={account('owner-a')}><AuditInput source="dashboard" /><RefreshAccount /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    fireEvent.change(input, { target: { value: 'example.com/pricing' } })
    fireEvent.submit(input.closest('form')!)
    const earlier = startScanWithHandoff.mock.calls[0][0]
    fireEvent.click(screen.getByRole('button', { name: 'Refresh account' }))
    await waitFor(() => expect(earlier.signal.aborted).toBe(true))
    expect(input).toBeEnabled()
    expect(input).toHaveValue('https://example.com/pricing')
    await act(async () => {
      earlier.onStarted({ siteId: 'first-account', isLoggedIn: true })
      earlier.navigate('/sites/first-account')
      finish({ ok: false, code: 'AUTH_REQUIRED', message: 'Old session response' })
    })
    expect(router.replace).not.toHaveBeenCalled()
    expect(trackStartedAudit).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(router.replace).toHaveBeenCalledExactlyOnceWith('/sites/second-account'))
    expect(startScanWithHandoff).toHaveBeenCalledTimes(2)
    expect(startScanWithHandoff.mock.calls[1][0].signal.aborted).toBe(false)
  })

  it('retires navigation and analytics callbacks when the URL form closes', async () => {
    let finish!: (result: { ok: false; code: string; message: string }) => void
    startScanWithHandoff.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const first = render(<MeProvider initialUser={null}><AuditInput source="dashboard" /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)
    const options = startScanWithHandoff.mock.calls[0][0]
    first.unmount()
    expect(options.signal.aborted).toBe(true)
    render(<MeProvider initialUser={null}><AuditInput source="dashboard" /></MeProvider>)
    await act(async () => {
      options.onStarted({ siteId: 'retired-site', reportId: 'retired-audit' })
      options.navigate('/sites/retired-site')
      finish({ ok: false, code: 'AUTH_REQUIRED', message: 'Create an account' })
    })
    expect(router.replace).not.toHaveBeenCalled()
    expect(trackStartedAudit).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Website URL' })).toBeEnabled()
  })

  it('releases the URL form after an unexpected handoff failure and retains its URL for retry', async () => {
    startScanWithHandoff.mockRejectedValueOnce(new Error('Unexpected handoff failure'))
      .mockResolvedValueOnce({ ok: true, siteId: 'retry-site' })
    render(<MeProvider initialUser={null}><AuditInput source="dashboard" /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent(AUDIT_ERRORS.admissionBusy)
    expect(input).toBeEnabled()
    expect(input).toHaveValue('https://example.com')
    expect(input).toHaveAttribute('aria-invalid', 'false')
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledTimes(2))
  })

  it('owns one pending submission and permits an explicit retry after refusal', async () => {
    let finish!: (result: { ok: false; message: string }) => void
    startScanWithHandoff.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce({ ok: true, siteId: 'site-retry' })
    render(<MeProvider initialUser={null}><AuditInput source="dashboard" idSuffix="-submission-owner" /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    const form = input.closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(startScanWithHandoff).toHaveBeenCalledTimes(1)
    expect(input).toBeDisabled()
    await act(async () => { finish({ ok: false, message: 'Try this request again.' }) })
    expect(input).toBeEnabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Try this request again.')
    fireEvent.submit(form)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledTimes(2))
  })

  it('continues starting a check when optional journey attribution is unavailable', async () => {
    readOrCreateAnalyticsJourneyId.mockImplementationOnce(() => { throw new Error('Storage unavailable') })
    startScanWithHandoff.mockResolvedValue({ ok: true, siteId: 'site-1' })
    render(<MeProvider initialUser={null}><AuditInput source="homepage" idSuffix="-optional-attribution" /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledTimes(1))
    expect(startScanWithHandoff.mock.calls[0][0].body.journeyId).toBeUndefined()
  })

  it('keeps the research surface separate from a real external campaign in the check and GA start', async () => {
    window.history.replaceState({}, '', '/?ff_entry=issue_page&utm_source=newsletter&utm_medium=email&utm_campaign=quality')
    startScanWithHandoff.mockImplementation(async (options) => {
      options.onStarted?.({ reportId: 'research-start', reused: false, isLoggedIn: false })
      return { ok: true, siteId: 'research-site', reportId: 'research-start' }
    })
    render(<MeProvider initialUser={null}><AuditInput idSuffix="-attribution-test" variant="landing" /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledOnce())
    expect(startScanWithHandoff).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({
      source: 'issue_page', utmSource: 'newsletter', utmMedium: 'email', utmCampaign: 'quality',
    }) }))
    expect(trackStartedAudit).toHaveBeenCalledWith(expect.objectContaining({ source: 'issue_page', utmSource: 'newsletter' }))
  })

  it.each([
    ['landing', undefined, 'ff_entry=untrusted', 'homepage'],
    ['landing', undefined, 'ff_entry=issue_page&ff_entry=tool_page', 'homepage'],
    ['landing', 'tool_page', 'ff_entry=issue_page', 'tool_page'],
    ['default', undefined, 'ff_entry=issue_page', 'dashboard'],
  ] as const)('does not let a query marker replace explicit or private entry context (%s, %s)', async (variant, source, query, expected) => {
    window.history.replaceState({}, '', `/?${query}`)
    startScanWithHandoff.mockResolvedValue({ ok: true, siteId: 'site', reportId: 'audit' })
    render(<MeProvider initialUser={null}><AuditInput idSuffix="-private-entry-test" variant={variant} source={source} /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledOnce())
    expect(startScanWithHandoff.mock.calls[0][0].body.source).toBe(expected)
    expect(startScanWithHandoff.mock.calls[0][0].body.utmMedium).toBeUndefined()
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

  it('keeps the URL valid after a request failure and waits for an explicit retry', async () => {
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
    expect(input).toHaveValue('https://example.com')
    expect(input).toHaveAttribute('aria-invalid', 'false')
    expect(input).not.toHaveAttribute('aria-describedby')
    const retryButton = screen.getByRole('button', { name: /Check your website/i })
    expect(retryButton).toBeEnabled()
    expect(startScanWithHandoff).toHaveBeenCalledOnce()

    fireEvent.click(retryButton)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledTimes(2))
  })

  it.each([
    ['default', 503, 'HTTP_503', false], ['landing', 503, 'HTTP_503', false],
    ['default', 400, 'INVALID_URL', true], ['landing', 400, 'INVALID_URL', true],
    ['default', 400, 'HTTP_400', false],
  ] as const)('attributes the %s form’s %s/%s refusal to its actual source', async (variant, status, code, invalid) => {
    const message = invalid ? 'FixFlags can only check publicly accessible URLs' : 'This request could not be completed.'
    const submitted = invalid ? 'https://192.168.1.1/' : 'https://example.com/'
    startScanWithHandoff.mockResolvedValue({ ok: false, status, code, message })
    render(<MeProvider initialUser={null}><AuditInput variant={variant} source="dashboard" idSuffix="-refusal-source" /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: submitted } })
    fireEvent.submit(input.closest('form')!)
    const feedback = await screen.findByRole('alert')
    expect(feedback).toHaveTextContent(message)
    expect(input).toHaveAttribute('aria-invalid', String(invalid))
    if (invalid) expect(input).toHaveAttribute('aria-describedby', feedback.id)
    else expect(input).not.toHaveAttribute('aria-describedby')
    expect(input).toHaveValue(submitted)
    expect(startScanWithHandoff).toHaveBeenCalledOnce()
    fireEvent.change(input, { target: { value: 'https://example.com/pricing' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'false')
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
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', `audit-url-error${idSuffix}`)

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
    ['default', 'https://example.com/pricing/', 'https://example.com/pricing/'],
    ['landing', 'https://example.com/?return=/checkout/', 'https://example.com/?return=/checkout/'],
    ['landing', 'https://example.com/#/pricing/', 'https://example.com/#/pricing/'],
    ['default', '  example.com/plans/  ', 'https://example.com/plans/'],
    ['default', 'example.com:8443/plans/?return=/account/#/pricing/', 'https://example.com:8443/plans/?return=/account/#/pricing/'],
    ['default', '//example.com:8443/plans/', 'https://example.com:8443/plans/'],
  ] as const)('preserves the supplied destination in the %s form: %s', async (variant, entered, expected) => {
    startScanWithHandoff.mockResolvedValue({ ok: true, siteId: 'exact-url-site', reportId: 'exact-url-report' })
    render(<MeProvider initialUser={null}><AuditInput variant={variant} idSuffix="-exact-destination" /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    await waitFor(() => expect(input).toBeEnabled())
    fireEvent.change(input, { target: { value: entered } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledOnce())
    expect(startScanWithHandoff).toHaveBeenCalledWith(expect.objectContaining({
      url: expected, body: expect.objectContaining({ url: expected }),
    }))
  })

  it('explains credential-bearing URLs before starting or attributing a check', async () => {
    render(<MeProvider initialUser={null}><AuditInput source="dashboard" /></MeProvider>)
    const input = screen.getByRole('textbox', { name: 'Website URL' })
    fireEvent.change(input, { target: { value: 'https://owner:secret@example.com/path' } })
    fireEvent.submit(input.closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent(AUDIT_ERRORS.urlCredentials)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(startScanWithHandoff).not.toHaveBeenCalled()
    expect(readOrCreateAnalyticsJourneyId).not.toHaveBeenCalled()
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
        url: 'https://example.com/',
        body: expect.objectContaining({
          url: 'https://example.com/',
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
      screen.getAllByText(/A free account adds fix instructions, saved results, and scheduled monitoring/i).length
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

  it('keeps the landing label and decorative arrow in one submit control', async () => {
    render(
      <MeProvider initialUser={null}>
        <AuditInput variant="landing" showLandingExtras={false} idSuffix="-cta-layout" />
      </MeProvider>,
    )

    const submit = await screen.findByRole('button', { name: /Check your website/i })
    expect(submit.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(submit.textContent).toMatch(/Check your website/)
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
      '/waitlist'
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

  it('does not let another account’s automatic handoff marker consume this account’s URL', async () => {
    const first = render(<MeProvider initialUser={account('owner-a')}><AuditInput initialUrl="https://example.com" autoStart /></MeProvider>)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledOnce())
    first.unmount()
    render(<MeProvider initialUser={account('owner-b')}><AuditInput initialUrl="https://example.com" autoStart /></MeProvider>)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledTimes(2))
    expect(startScanWithHandoff.mock.calls[1][0].signal.aborted).toBe(false)
  })

  it('starts only the surviving automatic handoff when effects are replayed', async () => {
    render(<StrictMode><MeProvider initialUser={null}><AuditInput initialUrl="https://example.com" autoStart /></MeProvider></StrictMode>)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledOnce())
    expect(startScanWithHandoff.mock.calls[0][0].signal.aborted).toBe(false)
  })

  it('does not consume the automatic handoff when its form closes before submission', async () => {
    const first = render(<MeProvider initialUser={null}><AuditInput initialUrl="https://example.com" autoStart /></MeProvider>)
    first.unmount()
    await act(async () => {})
    expect(startScanWithHandoff).not.toHaveBeenCalled()
    render(<MeProvider initialUser={null}><AuditInput initialUrl="https://example.com" autoStart /></MeProvider>)
    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledOnce())
    expect(startScanWithHandoff.mock.calls[0][0].signal.aborted).toBe(false)
  })

  it.each(['https://example.com', 'https://example.com/plans/?return=/account/#/pricing/'])('resumes the handed-off URL exactly once across a remount: %s', async url => {
    const first = render(
      <MeProvider initialUser={{ id: 'u1', email: 'a@b.com', plan: 'FREE' } as never}>
        <AuditInput idSuffix="-handoff" initialUrl={url} autoStart />
      </MeProvider>,
    )

    await waitFor(() => expect(startScanWithHandoff).toHaveBeenCalledTimes(1))
    expect(startScanWithHandoff).toHaveBeenCalledWith(
      expect.objectContaining({ url, body: expect.objectContaining({ url }) })
    )

    // The real round trip remounts the page (post-login -> dashboard), so the
    // same URL must not start a second analysis.
    first.unmount()
    render(
      <MeProvider initialUser={{ id: 'u1', email: 'a@b.com', plan: 'FREE' } as never}>
        <AuditInput idSuffix="-handoff-remount" initialUrl={url} autoStart />
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
