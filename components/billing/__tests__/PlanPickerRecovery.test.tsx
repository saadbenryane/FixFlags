import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PlanPickerDialog } from '../PlanPickerDialog'
import { BILLING_ACTION_COPY, PRICING } from '@/lib/marketing/copy-barrel'

const mocks = vi.hoisted(() => ({ user: { id: 'owner-a', plan: 'FREE', email: 'a@example.invalid' }, loading: false,
  navigate: vi.fn(), push: vi.fn(), track: vi.fn(), error: vi.fn(), message: vi.fn(), changed: vi.fn() }))
vi.mock('@/hooks/useMe', () => ({ useMe: () => ({ user: mocks.user, isLoading: mocks.loading }) }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: mocks.track }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/audit/active-audit', () => ({ getActiveAudit: () => null }))
vi.mock('@/lib/billing/paid-open', () => ({ isPaidCheckoutGatedClient: () => false }))
vi.mock('sonner', () => ({ toast: { error: mocks.error, message: mocks.message } }))

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks()
  mocks.user = { id: 'owner-a', plan: 'FREE', email: 'a@example.invalid' }; mocks.loading = false
  vi.stubGlobal('window', { ...window, getComputedStyle: window.getComputedStyle.bind(window), location: { assign: mocks.navigate }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) })
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
function Example() {
  const [open, setOpen] = useState(true)
  return <><button onClick={() => setOpen(true)}>Open plans</button><PlanPickerDialog open={open} onOpenChange={value => { mocks.changed(value); setOpen(value) }} source="billing" lockDismissal={false} /></>
}
const pro = () => screen.getByRole('button', { name: PRICING.pickerProCta })
const receipt = (url = 'https://checkout.example/current') => Response.json({ url })

it('accepts one choice before pending state renders and records only that intent', async () => {
  const fetch = vi.fn<(url: string, options: RequestInit) => Promise<Response>>(() => new Promise<Response>(() => {}))
  vi.stubGlobal('fetch', fetch)
  render(<Example />)
  const first = pro(), second = screen.getByRole('button', { name: PRICING.pickerStudioCta })
  act(() => { fireEvent.click(first); fireEvent.click(second) })
  expect(fetch).toHaveBeenCalledOnce()
  expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ plan: 'BUILDER' })
  expect(mocks.track.mock.calls.filter(([name]) => name === 'plan_picker_picked')).toEqual([
    ['plan_picker_picked', { plan: 'BUILDER', source: 'billing' }],
  ])
  expect(first).toBeDisabled(); expect(second).toBeDisabled()
  expect(screen.getAllByText(PRICING.pickerBusy)).toHaveLength(1)
})

it('ignores a dismissed checkout while a reopened picker owns a different request', async () => {
  const reads: Array<{ signal: AbortSignal; finish: (response: Response) => void }> = []
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise<Response>(finish => reads.push({ signal: options.signal, finish }))))
  render(<Example />)
  fireEvent.click(pro())
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(reads[0].signal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Open plans' }))
  expect(pro()).toBeEnabled()
  fireEvent.click(pro())
  await act(async () => { reads[0].finish(Response.json({ url: 'https://billing.example/obsolete' }, { status: 409 })) })
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(mocks.message).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeVisible()
  expect(mocks.changed).toHaveBeenCalledTimes(1)
  await act(async () => { reads[1].finish(receipt()) })
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith('https://checkout.example/current')
  expect(mocks.changed).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('retires an account’s checkout before another account uses the same picker', async () => {
  const reads: Array<{ signal: AbortSignal; finish: (response: Response) => void }> = []
  vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise<Response>(finish => reads.push({ signal: options.signal, finish }))))
  const view = render(<Example />)
  fireEvent.click(pro())
  mocks.user = { ...mocks.user, id: 'owner-b' }
  view.rerender(<Example />)
  expect(reads[0].signal.aborted).toBe(true)
  expect(pro()).toBeEnabled()
  await act(async () => { reads[0].finish(receipt('https://checkout.example/previous-account')) })
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(mocks.changed).not.toHaveBeenCalled()
  expect(mocks.error).not.toHaveBeenCalled()
  fireEvent.click(pro())
  await act(async () => { reads[1].finish(receipt()) })
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith('https://checkout.example/current')
})

it('releases a timed-out choice for retry while preserving the open picker', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise<Response>(() => {})).mockImplementation(async () => receipt()))
  render(<Example />)
  fireEvent.click(pro())
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(pro()).toBeEnabled()
  expect(screen.getByRole('dialog')).toBeVisible()
  expect(mocks.error).toHaveBeenCalledExactlyOnceWith(BILLING_ACTION_COPY.checkout.failed)
  expect(mocks.changed).not.toHaveBeenCalled()
  await act(async () => { fireEvent.click(pro()) })
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith('https://checkout.example/current')
})

it('tracks actual openings and waits for the account lookup before accepting choices', () => {
  const changed = vi.fn()
  mocks.loading = true
  const view = render(<PlanPickerDialog open={false} onOpenChange={changed} source="billing" />)
  expect(mocks.track).not.toHaveBeenCalled()
  view.rerender(<PlanPickerDialog open onOpenChange={changed} source="billing" />)
  expect(pro()).toBeDisabled()
  mocks.loading = false
  view.rerender(<PlanPickerDialog open onOpenChange={changed} source="billing" />)
  expect(pro()).toBeEnabled()
  expect(mocks.track.mock.calls.filter(([name]) => name === 'plan_picker_viewed')).toHaveLength(1)
  view.rerender(<PlanPickerDialog open={false} onOpenChange={changed} source="billing" />)
  view.rerender(<PlanPickerDialog open onOpenChange={changed} source="billing" />)
  expect(mocks.track.mock.calls.filter(([name]) => name === 'plan_picker_viewed')).toHaveLength(2)
})
