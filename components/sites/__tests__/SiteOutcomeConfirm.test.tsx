import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteOutcomeConfirmList, SiteOutcomeRow } from '@/components/sites/SiteOutcomeConfirm'
import { OUTCOME_CONFIRMATION, OUTCOME_KIND_LABELS } from '@/lib/marketing/copy'
import { watchableOutcomeKinds } from '@/lib/sites/outcome-kinds'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}))

function outcome(overrides: Partial<SiteOutcomeView> = {}): SiteOutcomeView {
  return {
    id: 'out-1',
    name: 'Contact support',
    slug: 'contact-support',
    description: null,
    inferenceSource: 'browser',
    confirmedAt: null,
    pageIds: [],
    pageUrls: ['https://example.com/support'],
    kind: 'GENERIC',
    criticality: 'IMPORTANT',
    environment: 'production',
    enabled: true,
    staleAfterMinutes: 11520,
    expectation: null,
    bindings: [],
    coverage: null,
    state: 'COULD_NOT_VERIFY',
    summary: 'Not verified yet.',
    lastVerifiedAt: null,
    validUntil: null,
    flagId: null,
    latestRunId: null,
    running: false,
    ...overrides,
  }
}

function respond(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

function lastBody(fetchMock: ReturnType<typeof vi.fn>) {
  return JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))
}

/**
 * The dead end this control replaces was text: "Inferred, confirmation required"
 * with nothing to click. The only way to prove it is a dead end no longer exists
 * is to render the row and look for what a customer can do.
 */
describe('SiteOutcomeRow confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('offers exactly the kinds FixFlags can check, and not one it cannot', () => {
    // Asserted against the browser-safe capability contract, not repeated in
    // the component. A test
    // that names SIGNUP and finds no button passes even if the control starts
    // offering a kind whose binding cannot validate, which is the exact defect
    // this row exists to prevent.
    const watchable = watchableOutcomeKinds()
    expect(watchable).toEqual(['CHECKOUT', 'SIGNUP', 'AVAILABILITY'])
    render(<SiteOutcomeRow siteId="site-1" outcome={outcome()} />)

    const offered = screen.getAllByRole('button').map((button) => button.textContent)
    expect(offered).toEqual(['CHECKOUT', 'AVAILABILITY'].map((kind) => OUTCOME_KIND_LABELS[kind as 'CHECKOUT' | 'AVAILABILITY']))
  })

  it('offers Signup only with a current authorized fixture and sends its identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SiteOutcomeRow siteId="site-1" outcome={outcome({ kind: 'SIGNUP' })} fixtures={[{
      id: 'fixture-1', name: 'Safe signup', targetUrl: 'https://example.com/signup',
      fieldMapping: {}, successCriterion: {}, resetUrl: 'https://example.com/reset',
      cleanupUrl: 'https://example.com/cleanup', version: 2, lastDryRunVersion: 2,
      lastDryRunAt: new Date().toISOString(), lastDryRunResult: { disposition: 'SUCCEEDED' },
      authorizedAt: new Date().toISOString(), enabled: true, hasValues: true, hasHookSecret: true,
    }]} />)
    fireEvent.click(screen.getByRole('button', { name: OUTCOME_KIND_LABELS.SIGNUP }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(lastBody(fetchMock)).toMatchObject({ kind: 'SIGNUP', fixtureId: 'fixture-1' })
    vi.unstubAllGlobals()
  })

  it('sends the kind the customer chose, so the Outcome gets a mechanism', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    render(<SiteOutcomeRow siteId="site-1" outcome={outcome()} />)
    fireEvent.click(screen.getByRole('button', { name: OUTCOME_KIND_LABELS.CHECKOUT }))

    expect(await screen.findByText(OUTCOME_CONFIRMATION.saved)).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sites/site-1/outcomes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ outcomeId: 'out-1', confirmed: true, kind: 'CHECKOUT' }),
      })
    )
    // The board is server-rendered, so a confirmation that does not refresh it
    // would leave the customer staring at an unchanged page.
    expect(refresh).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('shows the route’s reason a confirmation was refused, not a generic failure', async () => {
    // The route answers 400 with why. Discarding that and showing "Could not
    // save" would hide the only thing the customer can act on.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respond({ code: 'OUTCOME_KIND_UNWATCHABLE', message: OUTCOME_CONFIRMATION.kindUnwatchable }, 400)
      )
    )

    render(<SiteOutcomeRow siteId="site-1" outcome={outcome()} />)
    fireEvent.click(screen.getByRole('button', { name: OUTCOME_KIND_LABELS.AVAILABILITY }))

    expect(await screen.findByText(OUTCOME_CONFIRMATION.kindUnwatchable)).toBeVisible()
    expect(screen.queryByText(OUTCOME_CONFIRMATION.saveFailed)).not.toBeInTheDocument()
    expect(screen.queryByText(OUTCOME_CONFIRMATION.saved)).not.toBeInTheDocument()
    // Nothing changed, so nothing may claim it did.
    expect(refresh).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('falls back to a plain failure when the route gives no reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond({}, 500)))
    render(<SiteOutcomeRow siteId="site-1" outcome={outcome()} />)
    fireEvent.click(screen.getByRole('button', { name: OUTCOME_KIND_LABELS.AVAILABILITY }))
    expect(await screen.findByText(OUTCOME_CONFIRMATION.saveFailed)).toBeVisible()
    vi.unstubAllGlobals()
  })

  it('leads with the kind the site already told FixFlags, rather than re-asking', () => {
    render(
      <SiteOutcomeRow
        siteId="site-1"
        outcome={outcome({ kind: 'CHECKOUT', name: 'Checkout', bindings: [{ key: 'checkout-browser-v1', required: true, scope: null }] })}
      />
    )
    const buttons = screen.getAllByRole('button').map((button) => button.textContent)
    expect(buttons[0]).toBe(OUTCOME_KIND_LABELS.CHECKOUT)
    expect(buttons).not.toContain(OUTCOME_KIND_LABELS.AVAILABILITY)
  })

  it('does not offer a different binding for a known protected Outcome', () => {
    render(<SiteOutcomeRow siteId="site-1" outcome={outcome({ kind: 'SIGNUP', name: 'Signup' })} />)
    expect(screen.getByText(OUTCOME_CONFIRMATION.unsupportedNote)).toBeVisible()
    expect(screen.queryByRole('button', { name: OUTCOME_KIND_LABELS.CHECKOUT })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: OUTCOME_KIND_LABELS.AVAILABILITY })).not.toBeInTheDocument()
  })

  it('says an inferred Outcome is not being watched yet, rather than implying otherwise', () => {
    render(<SiteOutcomeRow siteId="site-1" outcome={outcome()} />)
    expect(screen.getByText(OUTCOME_CONFIRMATION.inferredNote)).toBeVisible()
    expect(screen.queryByText(OUTCOME_CONFIRMATION.confirmedBadge)).not.toBeInTheDocument()
  })
})

describe('SiteOutcomeRow correction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renames a confirmed Outcome without re-agreeing to it', async () => {
    // "Looks right / Edit corrects inferred intent" is a correction, not a new
    // agreement. Confirming the same Outcome again is harmless but sending no
    // kind would be refused outright.
    const fetchMock = vi.fn().mockResolvedValue(respond({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <SiteOutcomeRow
        siteId="site-1"
        outcome={outcome({
          confirmedAt: '2026-09-29T00:00:00.000Z',
          inferenceSource: 'user',
          kind: 'CHECKOUT',
          bindings: [{ key: 'checkout-browser-v1', required: true, scope: null }],
          state: 'CLEAR',
        })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: OUTCOME_CONFIRMATION.edit }))
    fireEvent.change(screen.getByLabelText(OUTCOME_CONFIRMATION.nameLabel), {
      target: { value: 'A customer can check out' },
    })
    fireEvent.click(screen.getByRole('button', { name: OUTCOME_CONFIRMATION.save }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(lastBody(fetchMock)).toEqual({
      action: 'rename',
      outcomeId: 'out-1',
      name: 'A customer can check out',
    })
    expect(refresh).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('shows a confirmed Outcome its coverage and state, which Settings used to show', async () => {
    // Removing the dead end is not a reason to remove the facts beside it.
    render(
      <SiteOutcomeRow
        siteId="site-1"
        outcome={outcome({
          confirmedAt: '2026-09-29T00:00:00.000Z',
          inferenceSource: 'user',
          kind: 'CHECKOUT',
          bindings: [{ key: 'checkout-browser-v1', required: true, scope: null }],
          state: 'FLAG',
        })}
      />
    )
    expect(screen.getByText('Production · purchase path')).toBeVisible()
    expect(screen.getByText('Flag')).toBeVisible()
    // A confirmed Outcome is not asked to confirm itself again.
    expect(screen.queryByRole('button', { name: OUTCOME_KIND_LABELS.CHECKOUT })).not.toBeInTheDocument()
  })
})

describe('SiteOutcomeConfirmList', () => {
  it('says so plainly when the Site has no Outcomes yet', () => {
    render(<SiteOutcomeConfirmList siteId="site-1" outcomes={[]} />)
    expect(screen.getByText(OUTCOME_CONFIRMATION.noneConfirmed)).toBeVisible()
  })
})
