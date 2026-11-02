import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EmailPreferences } from '../EmailPreferences'
import { DEFAULT_NOTIFICATION_PREFERENCES as defaults } from '@/lib/notifications/preferences'
import { clearSettingsDrafts } from '@/lib/settings/drafts'

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))

afterEach(() => { cleanup(); clearSettingsDrafts(); vi.unstubAllGlobals() })
const props = { ownerId: 'email-owner', initial: defaults, nextSendAt: null, email: 'owner@example.com', emailVerified: true, hasMonitoredSites: true }
it('saves the chosen schedule and renders the confirmed server values', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true,
    notifications: { ...defaults, cadence: 'WEEKLY', nextSendAt: '2026-11-02T09:00:00.000Z' } }) })
  vi.stubGlobal('fetch', fetch)
  render(<EmailPreferences {...props} />)
  fireEvent.change(screen.getByLabelText('Website summary'), { target: { value: 'WEEKLY' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save email preferences' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Email preferences saved.'))
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ notifications: { cadence: 'WEEKLY' } })
  expect(screen.getByText(/Next summary:/)).toHaveTextContent('Nov 2, 2026')
})
it('retires a schedule draft confirmed after navigation before accepting a newer server schedule', async () => {
  let finish!: (response: unknown) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve })))
  const first = render(<EmailPreferences {...props} />)
  fireEvent.change(screen.getByLabelText('Website summary'), { target: { value: 'WEEKLY' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save email preferences' }))
  first.unmount()
  await act(async () => { finish({ ok: true, json: async () => ({ ok: true,
    notifications: { ...defaults, cadence: 'WEEKLY', nextSendAt: null } }) }) })
  const returned = render(<EmailPreferences {...props} initial={{ ...defaults, cadence: 'WEEKLY' }} />)
  expect(screen.getByLabelText('Website summary')).toHaveValue('WEEKLY')
  expect(screen.getByRole('button', { name: 'Save email preferences' })).toBeDisabled()
  returned.rerender(<EmailPreferences {...props} initial={{ ...defaults, cadence: 'DAILY' }} />)
  expect(screen.getByLabelText('Website summary')).toHaveValue('DAILY')
  expect(screen.getByRole('button', { name: 'Save email preferences' })).toBeDisabled()
  const clean = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(clean)
  expect(clean.defaultPrevented).toBe(false)
})
it('keeps an unsuccessful save editable and rejects invalid server responses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }))
  render(<EmailPreferences {...props} />)
  fireEvent.change(screen.getByLabelText('Website summary'), { target: { value: 'OFF' } })
  expect(screen.queryByLabelText('Delivery time')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Save email preferences' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not be saved'))
  expect(screen.getByRole('button', { name: 'Save email preferences' })).toBeEnabled()
  expect(screen.getByText(/Your website alert settings still apply/)).toBeInTheDocument()
})
it('shows the effective monitoring cadence and hides an unused weekly control', () => {
  render(<EmailPreferences {...props} followCadence="DAILY" />)
  expect(screen.getByText('Your monitoring currently gives you a daily summary.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Weekly delivery day')).toBeNull()
  expect(screen.getByRole('checkbox', { name: 'Send me product tips' })).not.toBeChecked()
})
it('saves a product tips choice without submitting summary fields', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true,
    notifications: { ...defaults, productTips: true, nextSendAt: null } }) })
  vi.stubGlobal('fetch', fetch)
  render(<EmailPreferences {...props} />)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Send me product tips' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save email preferences' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Email preferences saved.'))
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ notifications: { productTips: true } })
})
it('shows real delivery facts without claiming an email was read', () => {
  render(<EmailPreferences {...props} blocked history={[{ id: 'message', channel: 'summary', state: 'bounced', at: '2026-10-29T09:00:00Z' }]} />)
  expect(screen.getByText('Email address rejected')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('paused after a delivery problem')
  expect(screen.getByText(/does not confirm that you read it/)).toBeInTheDocument()
})
it('protects an edited schedule when leaving Settings', async () => {
  render(<EmailPreferences {...props} />)
  fireEvent.change(screen.getByLabelText('Website summary'), { target: { value: 'WEEKLY' } })
  fireEvent.click(screen.getByRole('link', { name: 'Manage website alerts' }))
  expect(await screen.findByRole('dialog')).toHaveTextContent('Unsaved changes')
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/dashboard'))
})
