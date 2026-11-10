import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutcomeConfirmControl, confirmableKinds } from '@/components/sites/SiteOutcomeConfirm'
import { OUTCOME_CONFIRMATION, OUTCOME_KIND_LABELS } from '@/lib/marketing/copy-barrel'
import { watchableOutcomeKinds } from '@/lib/sites/outcome-kinds'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'

const routerRefresh = vi.fn()
const onRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: routerRefresh }),
}))

type Outcome = Pick<SiteOutcomeView, 'id' | 'kind' | 'confirmedAt'>
const inferred = (overrides: Partial<Outcome> = {}): Outcome => ({ id: 'out-1', kind: 'GENERIC', confirmedAt: null, ...overrides })

function respond(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

/**
 * The dead end this control replaces was text: "Inferred, confirmation required"
 * with nothing to click. Rendering it and looking for what an owner can do is the
 * only proof that the dead end is gone.
 */
describe('Outcome confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('offers the watchable kinds that need no separate setup, from the capability contract', () => {
    expect(watchableOutcomeKinds()).toEqual(['CHECKOUT', 'SIGNUP', 'AVAILABILITY'])
    expect(confirmableKinds({ kind: 'GENERIC' })).toEqual(['CHECKOUT', 'AVAILABILITY'])
    render(<OutcomeConfirmControl siteId="site-1" outcome={inferred()} />)
    expect(screen.getAllByRole('button').map(button => button.textContent))
      .toEqual([OUTCOME_KIND_LABELS.CHECKOUT, OUTCOME_KIND_LABELS.AVAILABILITY])
  })

  it('sends the chosen kind and refreshes both the live Site resource and the page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    render(<OutcomeConfirmControl siteId="site-1" outcome={inferred()} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button', { name: OUTCOME_KIND_LABELS.CHECKOUT }))

    expect(await screen.findByText(OUTCOME_CONFIRMATION.saved)).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith('/api/sites/site-1/outcomes', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ outcomeId: 'out-1', confirmed: true, kind: 'CHECKOUT' }),
    }))
    expect(onRefresh).toHaveBeenCalled()
    expect(routerRefresh).toHaveBeenCalled()
  })

  it('shows the route’s reason a confirmation was refused and claims nothing changed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respond({ code: 'OUTCOME_KIND_UNWATCHABLE', message: OUTCOME_CONFIRMATION.kindUnwatchable }, 400)))
    render(<OutcomeConfirmControl siteId="site-1" outcome={inferred()} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button', { name: OUTCOME_KIND_LABELS.AVAILABILITY }))

    expect(await screen.findByText(OUTCOME_CONFIRMATION.kindUnwatchable)).toBeVisible()
    expect(screen.queryByText(OUTCOME_CONFIRMATION.saved)).not.toBeInTheDocument()
    expect(onRefresh).not.toHaveBeenCalled()
    expect(routerRefresh).not.toHaveBeenCalled()
  })

  it('falls back to a plain failure when the route gives no reason or cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({}, 500)))
    const { unmount } = render(<OutcomeConfirmControl siteId="site-1" outcome={inferred()} />)
    fireEvent.click(screen.getByRole('button', { name: OUTCOME_KIND_LABELS.AVAILABILITY }))
    expect(await screen.findByText(OUTCOME_CONFIRMATION.saveFailed)).toBeVisible()
    unmount()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    render(<OutcomeConfirmControl siteId="site-1" outcome={inferred()} />)
    fireEvent.click(screen.getByRole('button', { name: OUTCOME_KIND_LABELS.AVAILABILITY }))
    expect(await screen.findByText(OUTCOME_CONFIRMATION.saveFailed)).toBeVisible()
  })

  it('leads with the kind the site already told FixFlags, rather than re-asking', () => {
    render(<OutcomeConfirmControl siteId="site-1" outcome={inferred({ kind: 'CHECKOUT' })} />)
    expect(screen.getAllByRole('button').map(button => button.textContent)).toEqual([OUTCOME_KIND_LABELS.CHECKOUT])
  })

  it('does not offer a different kind for a Signup Outcome, which account checks cover', () => {
    render(<OutcomeConfirmControl siteId="site-1" outcome={inferred({ kind: 'SIGNUP' })} />)
    expect(screen.getByText(OUTCOME_CONFIRMATION.unsupportedNote)).toBeVisible()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders nothing once the Outcome is confirmed', () => {
    const { container } = render(<OutcomeConfirmControl siteId="site-1" outcome={inferred({ confirmedAt: '2026-09-29T00:00:00.000Z' })} />)
    expect(container).toBeEmptyDOMElement()
  })
})
