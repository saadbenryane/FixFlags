import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SitePromptCopyButton } from '../SitePromptCopyButton'
import { SiteFixBundleButton } from '../SiteFixBundleButton'
import { SITE_BOARD_COPY as B } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { REPORT_COPY } from '@/lib/marketing/copy/report-workspace'
import { CLIENT_REQUEST_TIMEOUT_MS } from '@/lib/api/client-request'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('ClipboardItem', undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => {}) }, configurable: true })
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    if (url.endsWith('/fix-prompt')) return Response.json({ ok: true, prompt: 'Exact repair instructions',
      tasks: [{ sourceFlagId: 'source', promptHash: 'a'.repeat(64) }] })
    if (JSON.parse(options.body as string).action === 'prepare') return Response.json({ ok: true, prompt: 'Exact repair instructions', sourceFlagId: 'source', promptHash: 'a'.repeat(64) })
    return new Promise<Response>(() => {})
  }))
})
afterEach(async () => { cleanup(); await act(async () => { await vi.advanceTimersByTimeAsync(0) }); vi.useRealTimers(); vi.unstubAllGlobals() })

it.each(['flag', 'bundle'])('keeps the %s copied state truthful until receipt recording ends', async kind => {
  const copyLabel = kind === 'flag' ? B.copyPrompt : C.fixAll
  const copiedLabel = kind === 'flag' ? B.copyPromptCopied : C.bundleCopied
  const notice = kind === 'flag' ? REPORT_COPY.explorer.promptCopiedRecordFailed : C.bundleRecordFailed
  render(kind === 'flag' ? <SitePromptCopyButton siteId="site" flagId="source" /> : <SiteFixBundleButton siteId="site" availability="available" />)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: copyLabel })); await vi.advanceTimersByTimeAsync(0) })
  expect(navigator.clipboard.writeText).toHaveBeenCalledExactlyOnceWith('Exact repair instructions')
  expect(screen.getByRole('button', { name: copiedLabel })).toBeDisabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
  expect(screen.getByRole('button', { name: copiedLabel })).toBeDisabled()
  expect(screen.queryByText(C.bundlePreparing)).not.toBeInTheDocument()
  await act(async () => { await vi.advanceTimersByTimeAsync(27_000) })
  expect(screen.getByText(notice)).toBeVisible()
  expect(screen.getByRole('button', { name: copiedLabel })).toBeEnabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(2500) })
  expect(screen.getByRole('button', { name: copyLabel })).toBeEnabled()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(navigator.clipboard.writeText).toHaveBeenCalledOnce()
})

it.each(['flag', 'bundle'])('offers selected manual %s instructions after an unconfirmed clipboard write', async kind => {
  let finish!: () => void
  vi.mocked(navigator.clipboard.writeText).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  const copyLabel = kind === 'flag' ? B.copyPrompt : C.fixAll
  render(kind === 'flag' ? <SitePromptCopyButton siteId="site" flagId="source" /> : <SiteFixBundleButton siteId="site" availability="available" />)
  const button = screen.getByRole('button', { name: copyLabel })
  await act(async () => { fireEvent.click(button); await vi.advanceTimersByTimeAsync(0) })
  expect(button).toBeDisabled()
  await act(async () => { await vi.advanceTimersByTimeAsync(CLIENT_REQUEST_TIMEOUT_MS) })
  expect(screen.getByRole('dialog')).toBeVisible()
  const instructions = screen.getByRole('textbox', { name: B.fixPromptLabel })
  expect(instructions).toHaveValue('Exact repair instructions')
  expect(instructions).toHaveFocus()
  expect(instructions).toHaveProperty('selectionStart', 0)
  expect(instructions).toHaveProperty('selectionEnd', 'Exact repair instructions'.length)
  expect(button).toBeEnabled()
  expect(fetch).toHaveBeenCalledOnce()
  await act(async () => { finish(); await vi.advanceTimersByTimeAsync(0) })
  expect(fetch).toHaveBeenCalledOnce()
  expect(screen.getByRole('dialog')).toBeVisible()
  expect(button).toHaveTextContent(copyLabel)
})
