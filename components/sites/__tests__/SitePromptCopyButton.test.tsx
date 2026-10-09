import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

describe('SitePromptCopyButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ prompt: 'Repair the checkout heading.' }),
    }))
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
  })
})
