import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OUTCOME_CONFIRMATION } from '@/lib/marketing/copy'

const mocks = vi.hoisted(() => ({
  loadSiteRecord: vi.fn(),
  confirmSiteOutcome: vi.fn(),
  confirmPageAvailability: vi.fn(),
  loadSiteFlagDetail: vi.fn(),
  executeProductCommand: vi.fn(),
}))

vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: mocks.loadSiteRecord }))
vi.mock('@/lib/sites/outcomes', async (importOriginal) => ({
  // `outcomeKindWatchable` is deliberately NOT mocked. The refusal under test is
  // derived from the same mechanism contract the run path validates against, so
  // stubbing it here would test the stub.
  ...(await importOriginal<typeof import('@/lib/sites/outcomes')>()),
  confirmSiteOutcome: mocks.confirmSiteOutcome,
  confirmPageAvailability: mocks.confirmPageAvailability,
}))
vi.mock('@/lib/sites/flags', () => ({ loadSiteFlagDetail: mocks.loadSiteFlagDetail }))
vi.mock('@/lib/products/application/commands', () => ({ executeProductCommand: mocks.executeProductCommand }))
vi.mock('@/lib/sites/application/run-requests', () => ({
  requestOutcomeRun: vi.fn(),
  requestSiteRun: vi.fn(),
  findReusableRun: vi.fn(),
}))
vi.mock('@/lib/sites/application/flag-verification', () => ({
  recordSiteFlagFix: vi.fn(),
  requireSiteFlagAttempt: vi.fn(),
}))
vi.mock('@/lib/analytics/site-events', () => ({ recordSiteLifecycleEvent: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { siteOutcome: { findMany: vi.fn() }, outcomeAssessment: { upsert: vi.fn() } } }))

import { executeSiteCommand } from '@/lib/sites/application/commands'

/**
 * An Outcome's `kind` is not a label. It selects the execution mechanism that
 * will verify the Outcome: a browser journey for a purchase, a safe form for a
 * signup, an HTTP check for page availability.
 *
 * That makes "confirmed with no kind" a state the product must not accept. It
 * writes a customer agreement, leaves the Outcome `GENERIC` so every customer
 * surface still filters it out, and adds no binding, so nothing can ever verify
 * it. The customer would have confirmed something and seen no change, forever.
 * Accepting it is worse than rejecting it, because it is recorded as agreed.
 */
describe('CONFIRM_OUTCOME', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadSiteRecord.mockResolvedValue({
      siteId: 'proj_1',
      kind: 'project',
      projectId: 'proj_1',
      url: 'https://example.com',
      canonicalHost: 'example.com',
    })
    mocks.confirmSiteOutcome.mockResolvedValue({ id: 'out_1', kind: 'AVAILABILITY' })
  })

  it('refuses a confirmation that carries no way to verify it', async () => {
    const result = await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      confirmed: true,
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected the confirmation to be refused')
    expect(result.code).toBe('OUTCOME_KIND_REQUIRED')
  })

  it('never writes the unverifiable confirmation, which is the whole point', async () => {
    await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      confirmed: true,
    })
    expect(mocks.confirmSiteOutcome).not.toHaveBeenCalled()
  })

  it('explains what is missing instead of reporting a missing Outcome', async () => {
    const result = await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      confirmed: true,
    })
    if (result.ok) throw new Error('expected the confirmation to be refused')
    // "Outcome not found" would send a customer looking for a row that exists.
    expect(result.error).not.toMatch(/not found/i)
    expect(result.error).toBe(OUTCOME_CONFIRMATION.kindRequired)
    // The three kinds are the three things FixFlags can actually watch, so the
    // message names them rather than leaving the customer guessing.
    expect(result.error).toMatch(/purchase/i)
    expect(result.error).toMatch(/signup/i)
  })

  it('confirms when a kind is supplied, because that is what will verify it', async () => {
    const result = await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      confirmed: true,
      kind: 'AVAILABILITY',
    })
    expect(result.ok).toBe(true)
    expect(mocks.confirmSiteOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcomeId: 'out_1', confirmed: true, kind: 'AVAILABILITY' }),
    )
  })

  it('still allows correcting an inferred Outcome without re-confirming it', async () => {
    // "Looks right / Edit corrects inferred intent" needs a way to withdraw an
    // agreement and rename it. That path carries no kind and must keep working.
    const result = await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      confirmed: false,
      name: 'A visitor can reach pricing',
    })
    expect(result.ok).toBe(true)
    expect(mocks.confirmSiteOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ confirmed: false, name: 'A visitor can reach pricing' }),
    )
  })

  it('still reports a missing Outcome as missing', async () => {
    mocks.confirmSiteOutcome.mockResolvedValue(null)
    const result = await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_missing',
      confirmed: true,
      kind: 'CHECKOUT',
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected a missing Outcome')
    expect(result.error).toBe('Outcome not found')
  })
})

/**
 * A kind is necessary but not sufficient. `SIGNUP` names a safe-form mechanism
 * whose binding cannot validate, so accepting the confirmation records an
 * agreement, puts a required binding on the Site, enables Verify on Home, and
 * then answers "Couldn't verify" on every run with nothing the customer can
 * change. It is the same failure as confirming with no kind at all, one step
 * further along, so it is refused the same way.
 */
describe('CONFIRM_OUTCOME with a kind FixFlags cannot run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadSiteRecord.mockResolvedValue({
      siteId: 'proj_1',
      kind: 'project',
      projectId: 'proj_1',
      url: 'https://example.com',
      canonicalHost: 'example.com',
    })
    // Stated here rather than inherited: the tests below have to tell "refused
    // the kind" apart from "wrote it", which means the write must succeed. A
    // missing stub would read as a refusal and quietly invert the assertions.
    mocks.confirmSiteOutcome.mockResolvedValue({ id: 'out_1', kind: 'CHECKOUT' })
  })

  it('refuses a signup, because no safe form can be proved reversible today', async () => {
    const result = await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      confirmed: true,
      kind: 'SIGNUP',
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected the signup confirmation to be refused')
    expect(result.code).toBe('OUTCOME_KIND_UNWATCHABLE')
  })

  it('never writes the unwatchable agreement, which is the whole point', async () => {
    await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      confirmed: true,
      kind: 'SIGNUP',
    })
    expect(mocks.confirmSiteOutcome).not.toHaveBeenCalled()
  })

  it('says what is missing and points at what FixFlags can watch instead', async () => {
    const result = await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      confirmed: true,
      kind: 'SIGNUP',
    })
    if (result.ok) throw new Error('expected the signup confirmation to be refused')
    expect(result.error).toBe(OUTCOME_CONFIRMATION.kindUnwatchable)
    // A refusal that only says "no" is its own dead end. It has to name the
    // missing prerequisite and a way forward the customer can actually take.
    expect(result.error).toMatch(/test account/i)
    expect(result.error).toMatch(/undo/i)
    expect(result.error).toMatch(/purchase/i)
    expect(result.error).toMatch(/page loads/i)
  })

  it('still confirms the two kinds FixFlags can keep', async () => {
    for (const kind of ['CHECKOUT', 'AVAILABILITY'] as const) {
      const result = await executeSiteCommand({
        type: 'CONFIRM_OUTCOME',
        siteId: 'proj_1',
        outcomeId: 'out_1',
        confirmed: true,
        kind,
      })
      expect(result.ok, `${kind} must stay confirmable`).toBe(true)
    }
    expect(mocks.confirmSiteOutcome).toHaveBeenCalledTimes(2)
  })

  it('still lets a signup Outcome be renamed or withdrawn, because that needs no mechanism', async () => {
    // Withdrawing an agreement must not require the mechanism that would have
    // verified it, or a customer could get stuck holding a promise they cannot
    // keep and cannot drop.
    const withdraw = await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      confirmed: false,
      name: 'A visitor can sign up',
    })
    expect(withdraw.ok).toBe(true)
  })
})
