import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SitePromptCopyButton } from '../SitePromptCopyButton'
import { SiteFixBundleButton } from '../SiteFixBundleButton'
import { SITE_BOARD_COPY as B } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'

type Kind = 'flag' | 'bundle'
function preparation(kind: Kind, changed = false) {
  const prompt = changed ? 'Updated repair instructions' : 'Original repair instructions'
  const task = { sourceFlagId: 'source', referenceFlagId: 'incident', promptHash: (changed ? 'b' : 'a').repeat(64) }
  return Response.json(kind === 'flag' ? { ok: true, prompt, ...task } : { ok: true, prompt, tasks: [task] })
}
function setup(kind: Kind, { changed = false, denied = false, inline = false } = {}) {
  const writeText = denied ? vi.fn().mockRejectedValue(new Error('Clipboard refused')) : vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  const recorded: string[] = []
  let prepares = 0
  const fetcher = vi.fn(async (url: string, options: RequestInit) => {
    if (url.endsWith('/fix-prompt') || JSON.parse(options.body as string).action === 'prepare') {
      return preparation(kind, changed && ++prepares > 1)
    }
    recorded.push(url)
    return Response.json({ ok: true, prompt: 'Recorded instructions', handoff: {
      flagId: 'source', action: 'HANDOFF_COPIED', improvementId: 'incident', sourceReviewId: 'audit',
    } })
  })
  vi.stubGlobal('fetch', fetcher)
  const presentation = inline ? 'preview' : 'button'
  render(kind === 'flag' ? <SitePromptCopyButton siteId="site" flagId="incident" presentation={presentation} />
    : <SiteFixBundleButton siteId="site" area="security" availability="available" presentation={presentation} />)
  return { fetcher, writeText, recorded, copyLabel: kind === 'flag' ? B.copyPrompt : C.fixCategory,
    copiedLabel: kind === 'flag' ? B.copyPromptCopied : C.bundleCopied }
}
async function openPreview() {
  fireEvent.click(screen.getByRole('button', { name: B.viewPrompt }))
  expect(await screen.findByRole('textbox', { name: B.fixPromptLabel })).toHaveValue('Original repair instructions')
  return screen.getByRole('dialog')
}
beforeEach(() => vi.stubGlobal('ClipboardItem', undefined))
afterEach(() => vi.unstubAllGlobals())

it.each(['flag', 'bundle'] as const)('copies the inspected %s through its canonical action without a separate close step', async kind => {
  const { fetcher, writeText, recorded, copyLabel, copiedLabel } = setup(kind)
  const dialog = await openPreview()
  expect(writeText).not.toHaveBeenCalled()
  expect(recorded).toHaveLength(0)
  fireEvent.click(within(dialog).getByRole('button', { name: copyLabel }))
  expect(await screen.findByRole('button', { name: copiedLabel }, { timeout: 5000 })).toBeEnabled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(writeText).toHaveBeenCalledExactlyOnceWith('Original repair instructions')
  expect(recorded).toEqual(['/api/sites/site/flags/incident/fix'])
  expect(fetcher).toHaveBeenCalledTimes(3)
})

it.each(['flag', 'bundle'] as const)('acknowledges an inline %s copy using the same label as its other actions', async kind => {
  const { copyLabel, copiedLabel, writeText } = setup(kind, { inline: true })
  fireEvent.click(screen.getByLabelText(C.promptPreview))
  expect(await screen.findByRole('textbox', { name: B.fixPromptLabel })).toHaveValue('Original repair instructions')
  fireEvent.click(screen.getByRole('button', { name: copyLabel }))
  expect(await screen.findByRole('button', { name: copiedLabel }, { timeout: 5000 })).toBeEnabled()
  expect(writeText).toHaveBeenCalledExactlyOnceWith('Original repair instructions')
})

it.each(['flag', 'bundle'] as const)('requires review of changed %s instructions and can copy directly from the updated review', async kind => {
  const { fetcher, writeText, recorded, copyLabel, copiedLabel } = setup(kind, { changed: true })
  const preview = await openPreview()
  fireEvent.click(within(preview).getByRole('button', { name: copyLabel }))
  expect(await screen.findByRole('textbox', { name: B.fixPromptLabel })).toHaveValue('Updated repair instructions')
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(within(screen.getByRole('dialog')).getByText(C.promptChanged)).toBeVisible()
  expect(writeText).not.toHaveBeenCalled()
  expect(recorded).toHaveLength(0)
  expect(fetcher).toHaveBeenCalledTimes(2)
  await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('button', { name: copyLabel })).toBeEnabled())
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: copyLabel }))
  expect(await screen.findByRole('button', { name: copiedLabel }, { timeout: 5000 })).toBeEnabled()
  expect(writeText).toHaveBeenCalledExactlyOnceWith('Updated repair instructions')
  expect(recorded).toHaveLength(1)
  expect(fetcher).toHaveBeenCalledTimes(4)
})

it.each(['flag', 'bundle'] as const)('opens manual %s instructions after clipboard refusal without recording a handoff', async kind => {
  const { fetcher, recorded, copyLabel } = setup(kind, { denied: true })
  const dialog = await openPreview()
  fireEvent.click(within(dialog).getByRole('button', { name: copyLabel }))
  const title = kind === 'flag' ? B.manualCopyTitle : C.bundleManual
  expect(await screen.findByRole('heading', { name: title })).toBeVisible()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  const manual = screen.getByRole('textbox', { name: B.fixPromptLabel }) as HTMLTextAreaElement
  expect(manual).toHaveValue('Original repair instructions')
  expect(screen.getByText(B.manualCopyBody)).toBeVisible()
  await waitFor(() => expect(manual).toHaveFocus())
  expect(manual.selectionStart).toBe(0)
  expect(manual.selectionEnd).toBe(manual.value.length)
  expect(recorded).toHaveLength(0)
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('starts the native clipboard write in the preview click before revalidation completes', async () => {
  const { fetcher, writeText, recorded, copyLabel, copiedLabel } = setup('flag')
  const dialog = await openPreview()
  let finish!: (response: Response) => void
  fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
  let supplied: Promise<Blob> | undefined
  class Item { constructor(public data: Record<string, Promise<Blob>>) {} }
  vi.stubGlobal('ClipboardItem', Item)
  const write = vi.fn(async (items: Item[]) => { supplied = items[0].data['text/plain']; await supplied })
  Object.assign(navigator.clipboard, { write })
  fireEvent.click(within(dialog).getByRole('button', { name: copyLabel }))
  expect(write).toHaveBeenCalledOnce()
  expect(recorded).toHaveLength(0)
  await act(async () => { finish(preparation('flag')) })
  expect(await screen.findByRole('button', { name: copiedLabel }, { timeout: 5000 })).toBeEnabled()
  expect((await supplied!).type).toBe('text/plain')
  expect(writeText).not.toHaveBeenCalled()
  expect(recorded).toHaveLength(1)
})

it.each(['flag', 'bundle'] as const)('recovers an unavailable inline %s preview by opening its instructions without copying', async kind => {
  const writeText = vi.fn()
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  let finish!: (response: Response) => void
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', fetcher)
  render(kind === 'flag' ? <SitePromptCopyButton siteId="site" flagId="incident" presentation="preview" />
    : <SiteFixBundleButton siteId="site" area="security" availability="available" presentation="preview" />)
  const summary = screen.getByLabelText(C.promptPreview)
  await waitFor(() => expect(summary).not.toHaveTextContent(C.bundleBody))
  expect(fetcher).toHaveBeenCalledTimes(1)
  fireEvent.click(summary)
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('button', { name: kind === 'flag' ? B.copyPrompt : C.fixCategory })).toBeDisabled()
  await act(async () => { finish(preparation(kind)) })
  expect(screen.getByRole('textbox', { name: B.fixPromptLabel })).toHaveValue('Original repair instructions')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: kind === 'flag' ? B.copyPrompt : C.fixCategory })).toBeEnabled()
  fireEvent.click(summary)
  fireEvent.click(summary)
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(writeText).not.toHaveBeenCalled()
  for (const [url, options] of fetcher.mock.calls) {
    expect(url).toBe(kind === 'flag' ? '/api/sites/site/flags/incident/fix' : '/api/sites/site/fix-prompt')
    if (kind === 'flag') expect(JSON.parse(options.body)).toEqual({ action: 'prepare' })
  }
})
