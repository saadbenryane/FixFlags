import { describe, expect, it } from 'vitest'
import { projectSiteHomeForViewer, viewerRepairGuidance } from '../viewer-projection'
import { siteFlagFixture, siteViewFixture } from './site-view-fixture'
import { siteViewerActions } from '../viewer-actions'

describe('Site viewer evidence and guidance boundary', () => {
  it.each([false, true])('redacts every guidance collection for an authorized nonowner (signed in: %s)', signedIn => {
    const original = siteViewFixture()
    original.actions = siteViewerActions(false, signedIn)
    const flag = siteFlagFixture({ fix: 'Private repair instructions', repairGuidance: 'ready' })
    original.flags = [flag]; original.recommendations = [flag]; original.resolvedFlags = [flag]
    const view = projectSiteHomeForViewer(original)
    for (const collection of [view.flags, view.recommendations, view.resolvedFlags]) {
      expect(collection[0]).toMatchObject({ fix: '', repairGuidance: 'unavailable', evidence: flag.evidence, priorityBand: 'fix_first' })
    }
    expect(original.flags[0].fix).toBe('Private repair instructions')
    expect(JSON.stringify(view)).not.toContain('Private repair instructions')
    expect(view.settings.github).toBeUndefined()
    expect(view.counts).toEqual(original.counts)
    expect(view.monitoringHistory).toEqual(original.monitoringHistory)
  })
  it('preserves owner guidance and strips undeclared internal fields before rendering or JSON publication', () => {
    const original = siteViewFixture()
    original.flags = [{ ...siteFlagFixture({ fix: 'Restore the accessible label.', repairGuidance: 'ready' }), internalSecret: 'not-a-wire-field' } as ReturnType<typeof siteFlagFixture>]
    const view = projectSiteHomeForViewer(original)
    expect(view.flags[0].fix).toBe('Restore the accessible label.')
    expect(JSON.stringify(view)).not.toContain('not-a-wire-field')
    expect(viewerRepairGuidance(original.flags[0], false)).toEqual({ fix: '', repairGuidance: 'unavailable' })
  })
})
