import { expect, it } from 'vitest'
import { siteDetailContextHref, siteDetailReturnDestination, type SiteWorkspaceOrigin } from '../workspace-location'

const origin: SiteWorkspaceOrigin = { siteId: 'site-1', viewMode: 'home', selectedCard: 'search' }
const flag = '/sites/site-1/flags/incident-1'

it.each(['pages', 'timeline', 'integrations'] as const)('round-trips the %s workspace without reopening an unrelated category or Flag', viewMode => {
  const href = siteDetailContextHref(flag, { ...origin, viewMode })
  const params = Object.fromEntries(new URL(href, 'https://fixflags.invalid').searchParams)
  expect(params).toEqual({ view: viewMode })
  expect(siteDetailReturnDestination('site-1', 'conversion', params)).toEqual({ view: viewMode, href: `/sites/site-1?view=${viewMode}#${viewMode}`,
    origin: { siteId: 'site-1', viewMode, selectedCard: null } })
})

it('keeps the selected category rather than substituting the Flag’s category', () => {
  const href = siteDetailContextHref(flag, origin)
  const params = Object.fromEntries(new URL(href, 'https://fixflags.invalid').searchParams)
  expect(siteDetailReturnDestination('site-1', 'conversion', params)).toEqual({ view: 'home', href: '/sites/site-1?category=search#category-search', origin })
})

it('returns an Overview shortcut to the closed overview', () => {
  const href = siteDetailContextHref(flag, { ...origin, selectedCard: null })
  expect(href).toBe(`${flag}?view=home`)
  expect(siteDetailReturnDestination('site-1', 'conversion', { view: 'home' })).toEqual({ view: 'home', href: '/sites/site-1', origin: { ...origin, selectedCard: null } })
})

it('preserves the notification source and specific attempt while replacing stale workspace context', () => {
  expect(siteDetailContextHref(`${flag}?source=watch-email&view=home&category=conversion#attempt-1`, { ...origin, viewMode: 'timeline' }))
    .toBe(`${flag}?source=watch-email&view=timeline#attempt-1`)
})

it.each(['/sites/site-2/flags/incident-1', '/sites/site-1/settings', '/sites/site-1/flags/', '/sites/site-1/flags/incident-1/history', '#product', 'https://elsewhere.invalid/sites/site-1/flags/incident-1', 'http://'])('leaves an unrelated or local destination intact: %s', href => {
  expect(siteDetailContextHref(href, origin)).toBe(href)
})

it.each([{}, { view: '//elsewhere.invalid' }, { view: ['pages', 'timeline'] }])('keeps the established category fallback for direct and invalid entry: %j', params => {
  expect(siteDetailReturnDestination('site-1', 'conversion', params)).toEqual({ view: 'home', href: '/sites/site-1?category=conversion#category-conversion', origin: { ...origin, selectedCard: 'conversion' } })
})

it.each(['//elsewhere.invalid', ['search', 'conversion']])('does not turn an invalid category into a return destination: %j', category => {
  expect(siteDetailReturnDestination('site-1', 'conversion', { view: 'home', category })).toEqual({ view: 'home', href: '/sites/site-1', origin: { ...origin, selectedCard: null } })
})

it('carries the owning workspace between verification and Flag details', () => {
  const outcome = '/sites/site-1/outcomes/checkout-1'
  expect(siteDetailContextHref(outcome, { ...origin, viewMode: 'pages' })).toBe(`${outcome}?view=pages`)
  expect(siteDetailContextHref(outcome, origin)).toBe(`${outcome}?view=home&category=search`)
})

it.each(['/sites/site-2/outcomes/checkout-1', '/sites/site-1/outcomes/', '/sites/site-1/outcomes/checkout-1/history', '/sites/site-1/outcomes/../settings'])('leaves unrelated verification destinations intact: %s', href => {
  expect(siteDetailContextHref(href, origin)).toBe(href)
})

it('keeps direct verification entry at the closed overview rather than guessing a category', () => {
  expect(siteDetailReturnDestination('site-1', null, {})).toEqual({ view: 'home', href: '/sites/site-1',
    origin: { ...origin, selectedCard: null } })
})
