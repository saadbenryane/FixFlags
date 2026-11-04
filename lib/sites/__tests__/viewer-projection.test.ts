import { describe, expect, it } from 'vitest'
import { projectSiteHomeForViewer, viewerRepairGuidance } from '../viewer-projection'
import { siteFlagFixture, siteViewFixture } from './site-view-fixture'
import { siteViewerActions } from '../viewer-actions'
import { buildBoardCards } from '../board-card'

describe('Site viewer evidence and guidance boundary', () => {
  it.each([false, true])('redacts every guidance collection for an authorized nonowner (signed in: %s)', signedIn => {
    const original = siteViewFixture()
    original.readAt = 1_793_000_000_000
    original.actions = siteViewerActions(false, signedIn)
    const flag = siteFlagFixture({ fix: 'Private repair instructions', repairGuidance: 'ready', repairEvidenceRevision: 'a'.repeat(64) })
    original.flags = [flag]; original.recommendations = [flag]; original.resolvedFlags = [flag]
    original.cards = buildBoardCards({ siteId: 'fixture-site', inFlight: false, hasLastKnown: true,
      health: { state: 'attention', answer: 'Needs attention', statusLabel: 'Needs attention' },
      coverageByArea: new Map(), flags: [flag], outcomes: [], pageCount: 1, captureUrl: null, checkedAt: null })
    original.cards[0].flagChips = [{ id: flag.id, title: flag.problem, href: '/sites/site/flags/flag', repairGuidance: 'ready', repairGuidanceReady: true }]
    const view = projectSiteHomeForViewer(original)
    for (const collection of [view.flags, view.recommendations, view.resolvedFlags]) {
      expect(collection[0]).toMatchObject({ fix: '', repairGuidance: 'unavailable', evidence: flag.evidence, priorityBand: 'fix_first' })
      expect(collection[0].repairEvidenceRevision).toBeUndefined()
    }
    expect(original.flags[0].fix).toBe('Private repair instructions')
    expect(JSON.stringify(view)).not.toContain('Private repair instructions')
    expect(view.settings.github).toBeUndefined()
    expect(view.counts).toEqual(original.counts)
    expect(view.readAt).toBe(original.readAt)
    expect(view.monitoringHistory).toEqual(original.monitoringHistory)
    expect(view.cards[0].flagChips[0]).not.toHaveProperty('repairGuidance')
    expect(view.cards[0].flagChips[0].repairGuidanceReady).toBe(false)
    expect(original.cards[0].flagChips[0].repairGuidance).toBe('ready')
  })
  it('preserves owner guidance and strips undeclared internal fields before rendering or JSON publication', () => {
    const original = siteViewFixture()
    original.readAt = 1_793_000_000_000
    original.flags = [{ ...siteFlagFixture({ fix: 'Restore the accessible label.', repairGuidance: 'ready', repairEvidenceRevision: 'a'.repeat(64) }), internalSecret: 'not-a-wire-field' } as ReturnType<typeof siteFlagFixture>]
    const view = projectSiteHomeForViewer(original)
    expect(view.flags[0].fix).toBe('Restore the accessible label.')
    expect(view.readAt).toBe(original.readAt)
    expect(view.flags[0].repairEvidenceRevision).toBe(original.flags[0].repairEvidenceRevision)
    expect(JSON.stringify(view)).not.toContain('not-a-wire-field')
    expect(viewerRepairGuidance(original.flags[0], false)).toEqual({ fix: '', repairGuidance: 'unavailable' })
  })
})
