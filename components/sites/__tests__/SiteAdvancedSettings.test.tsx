import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Link from 'next/link'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SiteAdvancedSettings } from '../SiteSettingsPanels'
import { SiteSettingsSection } from '../SiteSettingsSection'
import { SiteResearchConsentSettings } from '../SiteResearchConsentSettings'
import { SiteScanAccessSettings } from '../SiteScanAccessSettings'
import { SITE_SETTINGS_COPY as C } from '@/lib/marketing/copy/site-settings'
import { RESEARCH_CONSENT_COPY } from '@/lib/marketing/copy/research'
import { RESEARCH_CONSENT_VERSION } from '@/lib/growth/research-consent-contract'

const previousScroll = Element.prototype.scrollIntoView
let previousHref: string
beforeEach(() => {
  previousHref = window.location.href
  window.history.replaceState(null, '', '/sites/site/settings')
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  window.history.replaceState(null, '', previousHref)
  Element.prototype.scrollIntoView = previousScroll
  vi.unstubAllGlobals()
})

function summary() { return screen.getByText(C.advanced).closest('summary')! }

it('defers actual advanced form requests until opening and retains edits and loaded data after folding', async () => {
  const fetcher = vi.fn(async (url: string) => Response.json(url.includes('/scan-access')
    ? { configured: false, summary: null }
    : { enabled: false, policyVersion: RESEARCH_CONSENT_VERSION, grantedAt: null }))
  vi.stubGlobal('fetch', fetcher)
  render(<SiteAdvancedSettings><SiteScanAccessSettings siteId="site" /><SiteResearchConsentSettings siteId="site" /></SiteAdvancedSettings>)
  expect(fetcher).not.toHaveBeenCalled()
  expect(screen.queryByLabelText(C.access.username)).not.toBeInTheDocument()
  fireEvent.click(summary())
  await screen.findByRole('checkbox', { name: RESEARCH_CONSENT_COPY.choice })
  expect(fetcher).toHaveBeenCalledTimes(2)
  const username = screen.getByLabelText(C.access.username)
  const password = screen.getByLabelText(C.access.password)
  fireEvent.change(username, { target: { value: 'Preview owner' } })
  fireEvent.change(password, { target: { value: 'In-memory draft only' } })
  fireEvent.click(summary())
  expect(summary().closest('details')).not.toHaveAttribute('open')
  fireEvent.click(summary())
  expect(screen.getByLabelText(C.access.username)).toBe(username)
  expect(username).toHaveValue('Preview owner')
  expect(password).toHaveValue('In-memory draft only')
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it.each(['scan-access', 'account-checks', 'signup-setup', 'research'])('opens an initial recovery link and focuses its mounted section: %s', async hash => {
  window.history.replaceState(null, '', `#${hash}`)
  render(<SiteAdvancedSettings><SiteSettingsSection id={hash}>Requested setting</SiteSettingsSection></SiteAdvancedSettings>)
  expect(summary().closest('details')).toHaveAttribute('open')
  const target = screen.getByText('Requested setting')
  await waitFor(() => expect(target).toHaveFocus())
  expect(target).toHaveAttribute('tabindex', '-1')
  expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
})

it('reveals an unmounted section when the current page hash changes', async () => {
  render(<SiteAdvancedSettings><SiteSettingsSection id="research">Research setting</SiteSettingsSection></SiteAdvancedSettings>)
  expect(screen.queryByText('Research setting')).not.toBeInTheDocument()
  window.history.replaceState(null, '', '#research')
  fireEvent(window, new HashChangeEvent('hashchange'))
  const target = screen.getByText('Research setting')
  await waitFor(() => expect(target).toHaveFocus())
})

it('reopens and focuses the same recovery hash after folding without requiring another hashchange', async () => {
  window.history.replaceState(null, '', '#scan-access')
  render(<><a href="#scan-access" onClick={event => event.preventDefault()}>Open access settings</a>
    <SiteAdvancedSettings><SiteSettingsSection id="scan-access">Access setting</SiteSettingsSection></SiteAdvancedSettings></>)
  const target = screen.getByText('Access setting')
  await waitFor(() => expect(target).toHaveFocus())
  fireEvent.click(summary())
  expect(summary().closest('details')).not.toHaveAttribute('open')
  const link = screen.getByRole('link', { name: 'Open access settings' })
  link.focus()
  fireEvent.click(link)
  expect(summary().closest('details')).toHaveAttribute('open')
  await waitFor(() => expect(target).toHaveFocus())
})

it('leaves the current disclosure alone for other pages and modified or new-tab links', () => {
  render(<><Link href="/sites/other/settings#scan-access" onClick={event => event.preventDefault()}>Other Site</Link>
    <a href="#scan-access" target="_blank" onClick={event => event.preventDefault()}>New tab</a>
    <a href="#scan-access" onClick={event => event.preventDefault()}>Modified link</a>
    <SiteAdvancedSettings><SiteSettingsSection id="scan-access">Access setting</SiteSettingsSection></SiteAdvancedSettings></>)
  fireEvent.click(screen.getByRole('link', { name: 'Other Site' }))
  fireEvent.click(screen.getByRole('link', { name: 'New tab' }))
  fireEvent.click(screen.getByRole('link', { name: 'Modified link' }), { metaKey: true })
  expect(summary().closest('details')).not.toHaveAttribute('open')
  expect(screen.queryByText('Access setting')).not.toBeInTheDocument()
})
