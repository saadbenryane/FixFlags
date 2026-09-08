import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SiteFlagActions } from '../SiteFlagActions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}))

describe('SiteFlagActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('copies Fix this without treating copy as verification', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    render(<SiteFlagActions siteId="p_site" flagId="flag-1" fixText="Show a confirmation." />)
    expect(screen.getByRole('button', { name: SITE_BOARD_COPY.fixThis })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: SITE_BOARD_COPY.verifyFix })).toBeInTheDocument()
    await screen.getByRole('button', { name: SITE_BOARD_COPY.fixThis }).click()
    expect(await screen.findByText('Fix instructions copied')).toBeInTheDocument()
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
})
