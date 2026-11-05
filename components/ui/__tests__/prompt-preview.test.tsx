import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PromptPreviewButton } from '../prompt-preview'
import { SITE_BOARD_COPY as C } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY as D } from '@/lib/marketing/copy/site-dashboard'
import { SYSTEM_COPY } from '@/lib/marketing/copy/errors'

it('opens and focuses the preview while instructions load, then enables its actions without moving focus', async () => {
  let finish!: (text: string) => void
  const load = vi.fn(() => new Promise<string>(resolve => { finish = resolve }))
  const copy = vi.fn()
  render(<PromptPreviewButton loadPrompt={load} onCopy={copy} />)
  expect(load).not.toHaveBeenCalled()
  const opener = screen.getByRole('button', { name: C.viewPrompt })
  opener.focus()
  fireEvent.click(opener)
  const dialog = screen.getByRole('dialog', { name: C.fixPromptLabel })
  const heading = within(dialog).getByRole('heading')
  expect(within(dialog).getByRole('status')).toHaveTextContent(D.promptLoading)
  expect(within(dialog).getByRole('button', { name: C.selectPrompt })).toBeDisabled()
  expect(within(dialog).getByRole('button', { name: C.copyPrompt })).toBeDisabled()
  expect(within(dialog).getByRole('button', { name: 'Close' })).toBeEnabled()
  expect(heading).toHaveFocus()
  await act(async () => { finish('Exact recorded instructions\nKeep their original scope.') })
  expect(within(dialog).getByRole('textbox', { name: C.fixPromptLabel })).toHaveValue('Exact recorded instructions\nKeep their original scope.')
  expect(heading).toHaveFocus()
  expect(copy).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: C.copyPrompt }))
  expect(copy).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('keeps a dismissed loading preview closed when preparation finishes late', async () => {
  let finish!: (text: string) => void
  render(<PromptPreviewButton loadPrompt={() => new Promise(resolve => { finish = resolve })} />)
  const opener = screen.getByRole('button', { name: C.viewPrompt })
  opener.focus()
  fireEvent.click(opener)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  await waitFor(() => expect(opener).toHaveFocus())
  await act(async () => { finish('Late instructions') })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(opener).toHaveFocus()
})

it('does not let an earlier dismissed request replace a reopened preview', async () => {
  const reads: Array<(text: string) => void> = []
  render(<PromptPreviewButton loadPrompt={() => new Promise(resolve => { reads.push(resolve) })} />)
  const opener = screen.getByRole('button', { name: C.viewPrompt })
  fireEvent.click(opener)
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  fireEvent.click(opener)
  expect(reads).toHaveLength(2)
  await act(async () => { reads[1]('Current instructions'); reads[0]('Obsolete instructions') })
  expect(screen.getByRole('textbox', { name: C.fixPromptLabel })).toHaveValue('Current instructions')
})

it.each(['failure', 'empty'] as const)('recovers an unavailable preview after %s in the same dialog', async mode => {
  const load = vi.fn().mockImplementationOnce(() => mode === 'failure' ? Promise.reject(new Error('Recorded instructions are unavailable')) : Promise.resolve('  '))
    .mockResolvedValueOnce('Recovered instructions')
  render(<PromptPreviewButton loadPrompt={load} />)
  fireEvent.click(screen.getByRole('button', { name: C.viewPrompt }))
  const error = await screen.findByRole('alert')
  expect(error).toHaveTextContent(mode === 'failure' ? 'Recorded instructions are unavailable' : C.copyPromptFailed)
  const dialog = screen.getByRole('dialog')
  expect(dialog).toContainElement(error)
  const retry = within(dialog).getByRole('button', { name: SYSTEM_COPY.actions.retry })
  retry.focus()
  fireEvent.click(retry)
  expect(await screen.findByRole('textbox', { name: C.fixPromptLabel })).toHaveValue('Recovered instructions')
  expect(screen.getByRole('dialog')).toBe(dialog)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(load).toHaveBeenCalledTimes(2)
  expect(within(dialog).getByRole('heading')).toHaveFocus()
})

it('keeps locked previews with their access action and performs no preparation', () => {
  const locked = vi.fn(), load = vi.fn()
  render(<PromptPreviewButton loadPrompt={load} onLockedAction={locked} />)
  fireEvent.click(screen.getByRole('button', { name: C.viewPrompt }))
  expect(locked).toHaveBeenCalledOnce()
  expect(load).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
