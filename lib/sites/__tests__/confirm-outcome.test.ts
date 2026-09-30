import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OUTCOME_CONFIRMATION } from '@/lib/marketing/copy'

const mocks = vi.hoisted(() => ({
  loadSiteRecord: vi.fn(),
  confirmSiteOutcome: vi.fn(),
  renameSiteOutcome: vi.fn(),
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
  renameSiteOutcome: mocks.renameSiteOutcome,
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
import { OutcomeKindMismatchError } from '@/lib/sites/outcomes'
import type { ConfirmableOutcomeKind } from '@/lib/sites/outcome-kinds'

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
    // The safe runnable kinds are named rather than leaving the customer
    // guessing.
    expect(result.error).toMatch(/purchase/i)
    expect(result.error).toMatch(/page loads/i)
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

  it('still allows withdrawing an inferred Outcome without assigning a mechanism', async () => {
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

  it('reports a semantic conflict when a known Outcome is reclassified', async () => {
    mocks.confirmSiteOutcome.mockRejectedValueOnce(new OutcomeKindMismatchError('SIGNUP', 'AVAILABILITY'))
    const result = await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      confirmed: true,
      kind: 'AVAILABILITY',
    })

    expect(result).toEqual({
      ok: false,
      error: OUTCOME_CONFIRMATION.kindMismatch,
      code: 'OUTCOME_KIND_MISMATCH',
    })
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

describe('RENAME_OUTCOME', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadSiteRecord.mockResolvedValue({
      siteId: 'proj_1',
      kind: 'project',
      projectId: 'proj_1',
      url: 'https://example.com',
      canonicalHost: 'example.com',
    })
    mocks.renameSiteOutcome.mockResolvedValue({
      id: 'out_1',
      name: 'A customer can check out',
      kind: 'CHECKOUT',
    })
  })

  it('renames without re-confirming or changing the execution kind', async () => {
    const result = await executeSiteCommand({
      type: 'RENAME_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      name: 'A customer can check out',
    })

    expect(result.ok).toBe(true)
    expect(mocks.renameSiteOutcome).toHaveBeenCalledWith(expect.objectContaining({
      outcomeId: 'out_1',
      name: 'A customer can check out',
    }))
    expect(mocks.confirmSiteOutcome).not.toHaveBeenCalled()
  })
})

/**
 * A kind is necessary but not sufficient. Some kinds may name mechanisms
 * that cannot validate their binding config, so accepting the confirmation
 * would record an agreement that can never be verified. That is the same
 * failure as confirming with no kind at all, so it is refused the same way.
 *
 * Protected journeys are discovered but remain unwatchable until their binding
 * carries tenant-scoped test access and a reversible fixture. The confirmation
 * boundary refuses those promises before writing anything.
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
    mocks.confirmSiteOutcome.mockResolvedValue({ id: 'out_1', kind: 'CHECKOUT' })
  })

  it('confirms all currently watchable kinds', async () => {
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

  it('refuses protected journeys before writing an agreement', async () => {
    for (const kind of ['SIGNUP', 'LOGIN', 'PASSWORD_RESET'] as const) {
      const result = await executeSiteCommand({
        type: 'CONFIRM_OUTCOME',
        siteId: 'proj_1',
        outcomeId: 'out_1',
        confirmed: true,
        kind,
      })
      expect(result.ok, `${kind} must stay unavailable without a safe fixture`).toBe(false)
      if (result.ok) throw new Error('expected protected journey to be refused')
      expect(result.code).toBe('OUTCOME_KIND_UNWATCHABLE')
    }
    expect(mocks.confirmSiteOutcome).not.toHaveBeenCalled()
  })

  it('still lets an Outcome be renamed or withdrawn, because that needs no mechanism', async () => {
    const withdraw = await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      confirmed: false,
      name: 'A visitor can sign up',
    })
    expect(withdraw.ok).toBe(true)
  })

  it('refuses a kind not in CONFIRMABLE_OUTCOME_KINDS', async () => {
    const result = await executeSiteCommand({
      type: 'CONFIRM_OUTCOME',
      siteId: 'proj_1',
      outcomeId: 'out_1',
      confirmed: true,
      kind: 'UNKNOWN_KIND' as ConfirmableOutcomeKind,
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected unknown kind to be refused')
    expect(result.code).toBe('OUTCOME_KIND_UNWATCHABLE')
  })
})
