import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toaster, toast } from 'sonner'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { REPORT_COPY } from '@/lib/marketing/copy/report-workspace'

describe('SitePromptCopyButton', () => {
  afterEach(() => {
    toast.dismiss()
  })

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => ({
      ok: true,
      json: async () => JSON.parse(options!.body as string).action === 'prepare'
        ? { ok: true, prompt: 'Repair the checkout heading.', sourceFlagId: 'flag-1', promptHash: 'a'.repeat(64) }
        : { ok: true, prompt: 'Repair the checkout heading.', handoff: { flagId: 'flag-1', action: 'HANDOFF_COPIED', improvementId: 'improvement-1', sourceReviewId: 'audit-1' } },
    })))
  })

  it('offers the public prompt guide after copying a real Flag prompt', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<><SitePromptCopyButton siteId="site-1" flagId="flag-1" /><Toaster /></>)
    fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt }))
    expect(await screen.findByRole('link', { name: 'How to use this prompt' })).toHaveAttribute('href', '/docs/fix-with-ai')
    expect(writeText).toHaveBeenCalledWith('Repair the checkout heading.')
  })

  it('reveals a selected prompt when the clipboard is blocked', async () => {
    const select = vi.spyOn(HTMLTextAreaElement.prototype, 'select')
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<SitePromptCopyButton siteId="site-1" flagId="flag-1" />)
    fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt }))
    const prompt = await screen.findByRole('textbox', { name: SITE_BOARD_COPY.fixPromptLabel })
    expect(prompt).toHaveValue('Repair the checkout heading.')
    expect(screen.getByText(SITE_BOARD_COPY.manualCopyBody)).toBeVisible()
    expect(prompt).toHaveFocus()
    expect(select).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith('/api/sites/site-1/flags/flag-1/fix', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).action).toBe('prepare')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('records the original source handoff only after the clipboard promise completes', async () => {
    let complete!: () => void
    const pending = new Promise<void>(resolve => { complete = resolve })
    const writeText = vi.fn(() => pending)
    Object.assign(navigator, { clipboard: { writeText } })
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => ({
      ok: true,
      json: async () => JSON.parse(options!.body as string).action === 'prepare'
        ? { ok: true, prompt: 'Repair the checkout heading.', sourceFlagId: 'source-flag', promptHash: 'a'.repeat(64) }
        : { ok: true, prompt: 'Repair the checkout heading.', handoff: { flagId: 'source-flag', action: 'HANDOFF_COPIED', improvementId: 'improvement-1', sourceReviewId: 'audit-1' } },
    })))
    render(<SitePromptCopyButton siteId="site-1" flagId="improvement-1" />)
    fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).action).toBe('prepare')
    expect(screen.queryByText(SITE_BOARD_COPY.copyPromptCopied)).not.toBeInTheDocument()
    await act(async () => complete())
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenLastCalledWith('/api/sites/site-1/flags/source-flag/fix', expect.objectContaining({
      body: JSON.stringify({ action: 'copy', promptHash: 'a'.repeat(64) }),
    }))
  })

  it('distinguishes a completed clipboard write from a refused handoff receipt', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true,
      prompt: 'Repair the checkout heading.', sourceFlagId: 'source-flag', promptHash: 'a'.repeat(64) }) } as Response)
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: 'Task changed', code: 'REPAIR_TASK_CHANGED' }) } as Response)
    render(<SitePromptCopyButton siteId="site-1" flagId="improvement-1" />)
    fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt }))
    expect(await screen.findByText(text => text.startsWith(REPORT_COPY.explorer.promptCopiedRecordFailed))).toBeVisible()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Repair the checkout heading.')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText(SITE_BOARD_COPY.copyPromptCopied)).not.toBeInTheDocument()
  })
})
