import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteResearchConsentSettings } from '../SiteResearchConsentSettings'
import { RESEARCH_CONSENT_COPY as C } from '@/lib/marketing/copy/research'
import { RESEARCH_CONSENT_VERSION } from '@/lib/growth/research-consent-contract'
const response = (enabled: boolean, ok = true) => ({ ok, json: async () => ({ enabled, policyVersion: RESEARCH_CONSENT_VERSION, grantedAt: enabled ? '2026-10-13T10:00:00Z' : null }) })
afterEach(() => vi.unstubAllGlobals())
describe('research permission in Site settings', () => {
  it('shows the optional scope, defaults to the saved off state, and sends the current policy', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(false)).mockResolvedValueOnce(response(true)).mockResolvedValueOnce(response(false))
    vi.stubGlobal('fetch', fetch)
    render(<SiteResearchConsentSettings siteId="site" />)
    const checkbox = await screen.findByRole('checkbox', { name: C.choice })
    expect(checkbox).not.toBeChecked()
    expect(screen.getByText(C.boundary)).toBeVisible(); expect(screen.getByText(C.withdrawal)).toBeVisible()
    fireEvent.click(checkbox)
    await waitFor(() => expect(checkbox).toBeChecked())
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/sites/site/research-consent', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ enabled: true, policyVersion: RESEARCH_CONSENT_VERSION }),
    }))
    fireEvent.click(checkbox)
    await waitFor(() => expect(checkbox).not.toBeChecked())
  })
  it('does not claim a successful withdrawal when the save is unconfirmed, and can reread it', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(true)).mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce(response(false))
    vi.stubGlobal('fetch', fetch)
    render(<SiteResearchConsentSettings siteId="site" />)
    const checkbox = await screen.findByRole('checkbox', { name: C.choice })
    fireEvent.click(checkbox)
    expect(await screen.findByRole('alert')).toHaveTextContent(C.failed)
    expect(checkbox).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: C.retry }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: C.choice })).not.toBeChecked())
  })
  it('does not display an unknown permission as an off choice', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(false, false)))
    render(<SiteResearchConsentSettings siteId="site" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(C.unavailable)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
