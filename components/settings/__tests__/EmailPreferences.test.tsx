import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EmailPreferences } from '../EmailPreferences'
import { DEFAULT_NOTIFICATION_PREFERENCES as defaults } from '@/lib/notifications/preferences'
import { clearSettingsDrafts } from '@/lib/settings/drafts'
import { NOTIFICATIONS_COPY as C } from '@/lib/marketing/copy/notifications'

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))

afterEach(() => { cleanup(); clearSettingsDrafts(); vi.useRealTimers(); vi.unstubAllGlobals() })
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
it('keeps unconfirmed acceptance distinct from a provider-reported delivery failure', () => {
  render(<EmailPreferences {...props} history={[
    { id: 'uncertain', channel: 'summary', state: 'unconfirmed', at: '2026-10-29T09:00:00Z' },
    { id: 'rejected', channel: 'summary', state: 'failed', at: '2026-10-28T09:00:00Z' },
  ]} />)
  expect(screen.getByText('Delivery could not be confirmed, open your websites for updates')).toBeInTheDocument()
  expect(screen.getByText('Could not deliver')).toBeInTheDocument()
})
it('protects an edited schedule when leaving Settings', async () => {
  render(<EmailPreferences {...props} />)
  fireEvent.change(screen.getByLabelText('Website summary'), { target: { value: 'WEEKLY' } })
  fireEvent.click(screen.getByRole('link', { name: 'Manage website alerts' }))
  expect(await screen.findByRole('dialog')).toHaveTextContent('Unsaved changes')
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/dashboard'))
})

it.each(['headers', 'body'] as const)('releases a save stalled at %s without losing the draft or accepting a late receipt', async phase => {
  vi.useFakeTimers()
  const saved = { ok: true, notifications: { ...defaults, cadence: 'WEEKLY', nextSendAt: '2026-11-09T09:00:00.000Z' } }
  let finish!: () => void, retry!: (response: Response) => void
  const fetcher = vi.fn().mockImplementationOnce(() => phase === 'headers'
    ? new Promise<Response>(resolve => { finish = () => resolve(Response.json(saved)) })
    : Promise.resolve({ ok: true, json: () => new Promise(resolve => { finish = () => resolve(saved) }) }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { retry = resolve }))
  vi.stubGlobal('fetch', fetcher)
  render(<EmailPreferences {...props} />)
  const cadence = screen.getByLabelText(C.frequency)
  fireEvent.change(cadence, { target: { value: 'WEEKLY' } })
  const form = cadence.closest('form')!
  await act(async () => { fireEvent.submit(form); fireEvent.submit(form) })
  expect(fetcher).toHaveBeenCalledTimes(1)
  const signal = fetcher.mock.calls[0][1].signal as AbortSignal
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(signal.aborted).toBe(true)
  expect(screen.getByRole('alert')).toHaveTextContent(C.error)
  expect(cadence).toHaveValue('WEEKLY')
  expect(screen.getByRole('button', { name: C.save })).toBeEnabled()
  fireEvent.submit(form)
  expect(fetcher).toHaveBeenCalledTimes(2)
  await act(async () => { finish() })
  expect(screen.getByRole('status')).not.toHaveTextContent(C.saved)
  expect(cadence).toBeDisabled()
  await act(async () => { retry(Response.json(saved)) })
  expect(screen.getByRole('status')).toHaveTextContent(C.saved)
  expect(cadence).toBeEnabled()
  expect(screen.getByText(/Next summary:/)).toHaveTextContent('Nov 9, 2026')
  expect(vi.getTimerCount()).toBe(0)
})

it('updates next-send metadata when the server advances the same schedule', () => {
  const view = render(<EmailPreferences {...props} nextSendAt="2026-11-02T09:00:00.000Z" />)
  expect(screen.getByText(/Next summary:/)).toHaveTextContent('Nov 2, 2026')
  view.rerender(<EmailPreferences {...props} nextSendAt="2026-11-03T09:00:00.000Z" />)
  expect(screen.getByText(/Next summary:/)).toHaveTextContent('Nov 3, 2026')
})

it('retires mutation-owned next-send metadata when a refreshed schedule arrives', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true,
    notifications: { ...defaults, cadence: 'WEEKLY', nextSendAt: '2026-11-09T09:00:00.000Z' } })))
  const view = render(<EmailPreferences {...props} />)
  fireEvent.change(screen.getByLabelText(C.frequency), { target: { value: 'WEEKLY' } })
  fireEvent.click(screen.getByRole('button', { name: C.save }))
  expect(await screen.findByText(/Next summary:/)).toHaveTextContent('Nov 9, 2026')
  view.rerender(<EmailPreferences {...props} initial={{ ...defaults, cadence: 'WEEKLY' }} nextSendAt="2026-11-16T09:00:00.000Z" />)
  await waitFor(() => expect(screen.getByText(/Next summary:/)).toHaveTextContent('Nov 16, 2026'))
  expect(screen.getByLabelText(C.frequency)).toHaveValue('WEEKLY')
})

it('does not pair a newer server delivery time with a different schedule from an older in-flight save', async () => {
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
  const view = render(<EmailPreferences {...props} nextSendAt="2026-11-02T09:00:00.000Z" />)
  fireEvent.change(screen.getByLabelText(C.frequency), { target: { value: 'WEEKLY' } })
  fireEvent.click(screen.getByRole('button', { name: C.save }))
  view.rerender(<EmailPreferences {...props} nextSendAt="2026-11-03T09:00:00.000Z" />)
  await act(async () => { finish(Response.json({ ok: true,
    notifications: { ...defaults, cadence: 'WEEKLY', nextSendAt: '2026-11-09T09:00:00.000Z' } })) })
  expect(screen.getByLabelText(C.frequency)).toHaveValue('WEEKLY')
  expect(screen.queryByText(/Next summary:/)).not.toBeInTheDocument()
  expect(screen.queryByText(C.schedulePending)).not.toBeInTheDocument()
  view.rerender(<EmailPreferences {...props} initial={{ ...defaults, cadence: 'WEEKLY' }} nextSendAt="2026-11-09T09:00:00.000Z" />)
  expect(await screen.findByText(/Next summary:/)).toHaveTextContent('Nov 9, 2026')
})
