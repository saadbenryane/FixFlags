import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { OutcomeNameControl } from '../OutcomeNameControl'
import { OUTCOME_CONFIRMATION as C } from '@/lib/marketing/copy/errors'
import { SITE_ACTION_COPY as A } from '@/lib/marketing/copy/site-actions'

const routeRefresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: routeRefresh }) }))
afterEach(() => { vi.unstubAllGlobals(); routeRefresh.mockClear() })
const saved = (name = 'Customer checkout', id = 'outcome') => ({ ok: true, outcome: { id, name, kind: 'CHECKOUT', environment: 'production' } })

it('opens the current name for correction and cancels with Escape without a request', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  render(<OutcomeNameControl siteId="site" outcomeId="outcome" name="Checkout" />)
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  const input = screen.getByRole('textbox', { name: C.nameLabel }) as HTMLInputElement
  expect(input).toHaveFocus()
  expect(input.selectionStart).toBe(0); expect(input.selectionEnd).toBe('Checkout'.length)
  fireEvent.change(input, { target: { value: 'Discarded draft' } })
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(screen.getByRole('button', { name: C.edit })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  expect(screen.getByRole('textbox', { name: C.nameLabel })).toHaveValue('Checkout')
  expect(fetch).not.toHaveBeenCalled()
})

it('saves only the normalized label, admits one request and restores focus after refresh', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json(saved()))
  vi.stubGlobal('fetch', fetch)
  const refresh = vi.fn().mockResolvedValue(undefined)
  render(<OutcomeNameControl siteId="site" outcomeId="outcome" name="Checkout" onRefresh={refresh} />)
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  const input = screen.getByRole('textbox', { name: C.nameLabel })
  fireEvent.change(input, { target: { value: '  Customer checkout  ' } })
  const form = input.closest('form')!
  fireEvent.submit(form); fireEvent.submit(form)
  expect(await screen.findByText(C.renamed)).toBeVisible()
  await waitFor(() => expect(screen.getByRole('button', { name: C.edit })).toHaveFocus())
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/sites/site/outcomes', expect.objectContaining({ method: 'POST',
    body: JSON.stringify({ action: 'rename', outcomeId: 'outcome', name: 'Customer checkout' }) }))
  expect(refresh).toHaveBeenCalledOnce()
  expect(routeRefresh).not.toHaveBeenCalled()
})

it('keeps a failed draft editable and succeeds on a deliberate retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Connection interrupted')).mockResolvedValueOnce(Response.json(saved())))
  render(<OutcomeNameControl siteId="site" outcomeId="outcome" name="Checkout" />)
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  fireEvent.change(screen.getByRole('textbox', { name: C.nameLabel }), { target: { value: 'Customer checkout' } })
  fireEvent.click(screen.getByRole('button', { name: C.save }))
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.getByRole('textbox', { name: C.nameLabel })).toHaveValue('Customer checkout')
  expect(screen.getByRole('button', { name: C.save })).toBeEnabled()
  expect(routeRefresh).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: C.save }))
  expect(await screen.findByText(C.renamed)).toBeVisible()
  expect(routeRefresh).toHaveBeenCalledOnce()
})

it.each([{}, saved('Customer checkout', 'another-outcome'), saved('Another label')])('refuses an incomplete or unrelated rename receipt', async receipt => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(receipt)))
  render(<OutcomeNameControl siteId="site" outcomeId="outcome" name="Checkout" />)
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  fireEvent.change(screen.getByRole('textbox', { name: C.nameLabel }), { target: { value: 'Customer checkout' } })
  fireEvent.click(screen.getByRole('button', { name: C.save }))
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.queryByText(C.renamed)).toBeNull()
  expect(routeRefresh).not.toHaveBeenCalled()
})

it('retires a pending correction on Site change without closing or refreshing the new editor', async () => {
  let finish!: (response: Response) => void
  let signal!: AbortSignal
  vi.stubGlobal('fetch', vi.fn((_url, options) => { signal = options.signal; return new Promise<Response>(resolve => { finish = resolve }) }))
  const refresh = vi.fn().mockResolvedValue(undefined)
  const rendered = render(<OutcomeNameControl siteId="first" outcomeId="outcome" name="Checkout" onRefresh={refresh} />)
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  fireEvent.change(screen.getByRole('textbox', { name: C.nameLabel }), { target: { value: 'Customer checkout' } })
  fireEvent.click(screen.getByRole('button', { name: C.save }))
  await waitFor(() => expect(signal).toBeDefined())
  rendered.rerender(<OutcomeNameControl siteId="second" outcomeId="outcome" name="Signup" onRefresh={refresh} />)
  expect(signal.aborted).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  await act(async () => { finish(Response.json(saved())) })
  expect(screen.getByRole('textbox', { name: C.nameLabel })).toHaveValue('Signup')
  expect(refresh).not.toHaveBeenCalled()
  expect(screen.queryByText(C.renamed)).toBeNull()
})

it('separates a saved name from an unavailable follow-up read', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(saved())))
  render(<OutcomeNameControl siteId="site" outcomeId="outcome" name="Checkout" onRefresh={async () => { throw new Error('Read unavailable') }} />)
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  fireEvent.change(screen.getByRole('textbox', { name: C.nameLabel }), { target: { value: 'Customer checkout' } })
  fireEvent.click(screen.getByRole('button', { name: C.save }))
  expect(await screen.findByText(A.refreshPending)).toBeVisible()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('button', { name: C.edit })).toBeEnabled()
})

it('keeps intentional outside focus while the saved name is refreshing', async () => {
  let finish!: () => void
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(saved())))
  render(<><button>Other Site controls</button><OutcomeNameControl siteId="site" outcomeId="outcome" name="Checkout"
    onRefresh={() => new Promise<void>(resolve => { finish = resolve })} /></>)
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  fireEvent.change(screen.getByRole('textbox', { name: C.nameLabel }), { target: { value: 'Customer checkout' } })
  fireEvent.click(screen.getByRole('button', { name: C.save }))
  await screen.findByText(C.renamed)
  const outside = screen.getByRole('button', { name: 'Other Site controls' })
  outside.focus()
  await act(async () => { finish() })
  expect(outside).toHaveFocus()
})

it.each(['delayed', 'failed'])('reopens the acknowledged name while the server-rendered name is %s, then follows later source changes', async mode => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(saved())))
  const refresh = async () => { if (mode === 'failed') throw new Error('Read unavailable') }
  const view = (name: string) => <OutcomeNameControl siteId="site" outcomeId="outcome" name={name} onRefresh={refresh} />
  const rendered = render(view('Checkout'))
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  fireEvent.change(screen.getByRole('textbox', { name: C.nameLabel }), { target: { value: 'Customer checkout' } })
  fireEvent.click(screen.getByRole('button', { name: C.save }))
  await screen.findByText(mode === 'failed' ? A.refreshPending : C.renamed)
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  expect(screen.getByRole('textbox', { name: C.nameLabel })).toHaveValue('Customer checkout')
  expect(screen.getByRole('button', { name: C.save })).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: C.nameLabel }), { target: { value: 'Unsubmitted choice' } })
  rendered.rerender(view('Customer checkout'))
  expect(screen.getByRole('textbox', { name: C.nameLabel })).toHaveValue('Unsubmitted choice')
  fireEvent.click(screen.getByRole('button', { name: C.cancel }))
  rendered.rerender(view('Plan checkout'))
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  expect(screen.getByRole('textbox', { name: C.nameLabel })).toHaveValue('Plan checkout')
  fireEvent.click(screen.getByRole('button', { name: C.cancel }))
  rendered.rerender(view('Checkout'))
  fireEvent.click(screen.getByRole('button', { name: C.edit }))
  expect(screen.getByRole('textbox', { name: C.nameLabel })).toHaveValue('Checkout')
})
