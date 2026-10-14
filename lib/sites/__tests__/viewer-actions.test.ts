import { describe, expect, it } from 'vitest'
import { siteContinuationHref, siteViewerActions } from '../viewer-actions'
import { siteViewFixture } from './site-view-fixture'
import { projectSiteBoard } from '../board-view'

describe('Site viewer action projection', () => {
  it('distinguishes an owner, an anonymous session and a signed-in provisional claim', () => {
    expect(siteViewerActions(true).copy).toBe('available')
    expect(siteViewerActions(false).copy).toBe('sign_in')
    expect(siteViewerActions(false, true).copy).toBe('claim')
    expect(siteContinuationHref('sign_in', '/sites/a/flags/f?view=evidence#result'))
      .toBe('/sign-in?next=%2Fsites%2Fa%2Fflags%2Ff%3Fview%3Devidence%23result')
    expect(siteContinuationHref('claim', '/sites/a')).toBe('/post-login?next=%2Fsites%2Fa')
  })

  it('keeps unknown areas discoverable without converting them to healthy', () => {
    const view = siteViewFixture()
    view.actions = siteViewerActions(false)
    view.cards = ['security', 'accessibility', 'uptime'].map(id => ({ id, evidenced: false, openFlagCount: 0, activity: null })) as typeof view.cards
    view.presentation.categories = view.cards.map(card => ({ id: card.id, state: 'unknown', flagCount: 0 })) as typeof view.presentation.categories
    expect(projectSiteBoard(view, 'fixture-site', false, false, null).visibleCategories.map(card => card.id))
      .toEqual(['security', 'accessibility', 'uptime'])
    expect(view.presentation.categories.every(card => card.state === 'unknown')).toBe(true)
  })
})
