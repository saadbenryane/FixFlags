import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { SiteFlagActions } from '../SiteFlagActions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}))

describe('SiteFlagActions', () => {
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
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ prompt: 'FixFlags Flag: Show a confirmation.' }) })
    vi.stubGlobal('fetch', fetchMock)
    render(<SiteFlagActions siteId="p_site" flagId="flag-1" />)
    expect(screen.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: SITE_BOARD_COPY.verifyFix })).toBeInTheDocument()
    await screen.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt }).click()
    expect(await screen.findByText('Fix prompt copied')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sites/p_site/flags/flag-1/fix',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'copy' }),
      })
    )
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/sites/p_site/flags/flag-1/verify',
      expect.anything()
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('copies a prompt without starting verify or exposing a private share action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ prompt: 'FixFlags Flag: No confirmation after contact' }) })
    vi.stubGlobal('fetch', fetchMock)
    const writeText = vi.mocked(navigator.clipboard.writeText)
    render(
      <SiteFlagActions siteId="p_site" flagId="flag-1" />
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ prompt: 'FixFlags Flag: Manual copy prompt' }),
    }))
    render(<SiteFlagActions siteId="p_site" flagId="flag-1" />)

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
    render(<SiteFlagActions siteId="p_site" flagId="flag-1" />)

    await screen.getByRole('button', { name: SITE_BOARD_COPY.verifyFix }).click()
    const dialog = await screen.findByRole('dialog')
    await screen.getAllByRole('button', { name: SITE_BOARD_COPY.verifyFix }).at(-1)!.click()

    expect(await screen.findByText(reason)).toBeVisible()
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
    render(<SiteFlagActions siteId="p_site" flagId="flag-1" />)

    await screen.getByRole('button', { name: SITE_BOARD_COPY.verifyFix }).click()
    await screen.getAllByRole('button', { name: SITE_BOARD_COPY.verifyFix }).at(-1)!.click()

    expect(await screen.findByText(reason)).toBeVisible()
    expect(screen.queryByText(SITE_BOARD_COPY.verificationFailed)).not.toBeInTheDocument()
  })
})
