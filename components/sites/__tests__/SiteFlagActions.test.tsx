import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { SiteFlagActions } from '../SiteFlagActions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

function copyResponse(prompt: string) {
  return vi.fn(async (_url, options) => ({ ok: true, json: async () => JSON.parse(options!.body as string).action === 'prepare'
    ? { ok: true, prompt, sourceFlagId: 'flag-1', promptHash: 'a'.repeat(64) }
    : { ok: true, prompt, handoff: { flagId: 'flag-1', action: 'HANDOFF_COPIED', improvementId: 'improvement-1', sourceReviewId: 'audit-1' } } }))
}

const refresh = vi.fn()
vi.mock('@/hooks/useSiteResource', () => ({ useSiteResource: (_siteId: string, initial: unknown) => ({ view: initial, refresh: vi.fn().mockResolvedValue(undefined), disconnected: false }) }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}))

describe('SiteFlagActions', () => {
  it.each(['pending', 'unavailable'] as const)('explains %s repair guidance without offering a copied handoff', async repairGuidance => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<SiteFlagActions repairGuidance={repairGuidance} initial={siteViewFixture()} siteId="p_site" flagId="flag-1" />)
    expect(screen.queryByRole('button', { name: SITE_BOARD_COPY.copyPrompt })).not.toBeInTheDocument()
    expect(screen.getByText(SITE_ACTION_COPY.repairGuidance[repairGuidance])).toBeVisible()
    expect(screen.getByRole('button', { name: SITE_BOARD_COPY.verifyFix })).toBeEnabled()
    if (repairGuidance === 'pending') {
      fireEvent.click(screen.getByRole('button', { name: SITE_ACTION_COPY.repairGuidance.refresh }))
      expect(refresh).toHaveBeenCalledTimes(1)
    } else expect(screen.getByRole('link', { name: SITE_ACTION_COPY.repairGuidance.overview })).toHaveAttribute('href', '/sites/p_site')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['ready', 'unavailable'] as const)('restores keyboard focus when the requested guidance refresh becomes %s', repairGuidance => {
    const view = render(<SiteFlagActions repairGuidance="pending" initial={siteViewFixture()} siteId="p_site" flagId="flag-1" />)
    const refreshGuidance = screen.getByRole('button', { name: SITE_ACTION_COPY.repairGuidance.refresh })
    refreshGuidance.focus()
    fireEvent.click(refreshGuidance)
    view.rerender(<SiteFlagActions repairGuidance={repairGuidance} initial={siteViewFixture()} siteId="p_site" flagId="flag-1" />)
    expect(repairGuidance === 'ready' ? screen.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt })
      : screen.getByRole('link', { name: SITE_ACTION_COPY.repairGuidance.overview })).toHaveFocus()
  })

  it('groups Fix and Monitor and submits one scoped check with the optional change summary', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202, json: async () => ({
      ok: true, accepted: true, runRequestId: 'run-1', runId: 'run-1', verificationAuditId: 'audit-1',
      siteId: 'p_site', flagId: 'flag-1', attemptId: 'attempt-1', parentAuditId: 'parent-1', expectedBehavior: 'The product appears in the cart',
    }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<SiteFlagActions repairGuidance="ready" initial={siteViewFixture()} siteId="p_site" flagId="flag-1" />)
    expect(screen.getByRole('heading', { name: 'Fix' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Monitor' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Check now' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Updated the cart handler' } })
    const check = within(dialog).getByRole('button', { name: 'Check now' })
    fireEvent.click(check)
    fireEvent.click(check)
    expect(await screen.findByText(SITE_BOARD_COPY.verificationStarted)).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/sites/p_site/flags/flag-1/verify', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ changeSummary: 'Updated the cart handler' }),
      headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }),
    }))
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('copies the fix prompt without treating copy as verification', async () => {
    const fetchMock = copyResponse('FixFlags Flag: Show a confirmation.')
    vi.stubGlobal('fetch', fetchMock)
    render(<SiteFlagActions repairGuidance="ready" initial={siteViewFixture()} siteId="p_site" flagId="flag-1" />)
    expect(screen.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: SITE_BOARD_COPY.verifyFix })).toBeInTheDocument()
    await screen.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt }).click()
    expect(await screen.findByText('Fix prompt copied')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sites/p_site/flags/flag-1/fix',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'copy', promptHash: 'a'.repeat(64) }),
      })
    )
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/sites/p_site/flags/flag-1/verify',
      expect.anything()
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('copies a prompt without starting verify or exposing a private share action', async () => {
    const fetchMock = copyResponse('FixFlags Flag: No confirmation after contact')
    vi.stubGlobal('fetch', fetchMock)
    const writeText = vi.mocked(navigator.clipboard.writeText)
    render(
      <SiteFlagActions repairGuidance="ready" initial={siteViewFixture()} siteId="p_site" flagId="flag-1" />
    )
    await screen.getByRole('button', { name: SITE_BOARD_COPY.sendFlagToAi }).click()
    expect(await screen.findByText('Fix prompt copied')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith('FixFlags Flag: No confirmation after contact')
    expect(screen.queryByRole('button', { name: SITE_BOARD_COPY.share })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/sites/p_site/flags/flag-1/verify',
      expect.anything()
    )
  })

  it('reveals the complete selected prompt when clipboard access fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    vi.stubGlobal('fetch', copyResponse('FixFlags Flag: Manual copy prompt'))
    render(<SiteFlagActions repairGuidance="ready" initial={siteViewFixture()} siteId="p_site" flagId="flag-1" />)

    await screen.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt }).click()

    const prompt = await screen.findByRole('textbox', { name: SITE_BOARD_COPY.fixPromptLabel })
    expect(prompt).toHaveValue('FixFlags Flag: Manual copy prompt')
    expect(prompt).toHaveFocus()
    expect(screen.getByText(SITE_BOARD_COPY.manualCopyBody)).toBeVisible()
  })

  it('shows the server reason when Flag verification cannot start', async () => {
    const reason = 'This Flag has no comparable source scope to verify.'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: reason, code: 'HTTP_400' }),
    }))
    render(<SiteFlagActions repairGuidance="ready" initial={siteViewFixture()} siteId="p_site" flagId="flag-1" />)

    await screen.getByRole('button', { name: SITE_BOARD_COPY.verifyFix }).click()
    const dialog = await screen.findByRole('dialog')
    await screen.getAllByRole('button', { name: SITE_BOARD_COPY.verifyFix }).at(-1)!.click()

    expect(await within(dialog).findByText(reason)).toBeVisible()
    expect(dialog).toBeVisible()
    expect(screen.queryByText(SITE_BOARD_COPY.verificationFailed)).not.toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('still shows an error field when the server did not send message', async () => {
    const reason = 'Claim this Site before verifying a fix.'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: reason }),
    }))
    render(<SiteFlagActions repairGuidance="ready" initial={siteViewFixture()} siteId="p_site" flagId="flag-1" />)

    await screen.getByRole('button', { name: SITE_BOARD_COPY.verifyFix }).click()
    await screen.getAllByRole('button', { name: SITE_BOARD_COPY.verifyFix }).at(-1)!.click()

    expect(await screen.findByText(reason)).toBeVisible()
    expect(screen.queryByText(SITE_BOARD_COPY.verificationFailed)).not.toBeInTheDocument()
  })

  it('keeps connection uncertainty visible inside the verification dialog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<SiteFlagActions repairGuidance="ready" initial={siteViewFixture()} siteId="p_site" flagId="flag-1" />)
    await screen.getByRole('button', { name: SITE_BOARD_COPY.verifyFix }).click()
    const dialog = screen.getByRole('dialog')
    await within(dialog).getByRole('button', { name: SITE_BOARD_COPY.verifyFix }).click()
    expect(await within(dialog).findByText(SITE_ACTION_COPY.interrupted)).toBeVisible()
    expect(dialog).toBeVisible()
    expect(refresh).not.toHaveBeenCalled()
    expect(screen.queryByText(SITE_BOARD_COPY.verificationStarted)).not.toBeInTheDocument()
  })
})
