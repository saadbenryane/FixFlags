import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConnectAiPage, { metadata } from '../page'
import { AI_CONNECTION_COPY as C } from '@/lib/marketing/copy/ai-connection'
import { CARE_HOME } from '@/lib/marketing/copy/care-homepage'
import { buildEditorSetupPath } from '@/lib/integrations/editor-config'

vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AI connection explainer', () => {
  it('explains the value without promising zero token use for AI repairs', () => {
    render(<ConnectAiPage />)
    expect(screen.getByRole('heading', { level: 1, name: C.title })).toBeVisible()
    expect(C.title).not.toBe(CARE_HOME.builtForAi.titleLines.join(' '))
    expect(screen.getByText(/Reading the results and making fixes with your AI still uses its tokens/)).toBeVisible()
    expect(metadata.alternates?.canonical).toMatch(/\/connect-ai$/)
  })

  it('offers setup, the steps, and key handling', () => {
    render(<ConnectAiPage />)
    expect(screen.getByRole('heading', { level: 2, name: C.connection.title })).toBeVisible()
    expect(screen.getByRole('link', { name: C.connection.action })).toHaveAttribute('href', buildEditorSetupPath('cursor'))
    for (const step of C.connection.steps) expect(screen.getByText(step)).toBeVisible()
    expect(screen.getByText(C.connection.privacy)).toBeVisible()
    expect(screen.getByText(C.connection.workBody)).toBeVisible()
  })

  it('copies only a connection check, without starting work', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(<ConnectAiPage />)
    fireEvent.click(screen.getByRole('button', { name: C.prompt.copy }))
    expect(await screen.findByRole('status')).toHaveTextContent(C.prompt.copied)
    expect(writeText).toHaveBeenCalledWith(C.prompt.body)
    expect(C.prompt.body).toContain('Do not start a check or record a fix.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('selects the readable prompt when copying is blocked', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<ConnectAiPage />)
    fireEvent.click(screen.getByRole('button', { name: C.prompt.copy }))
    expect(await screen.findByRole('status')).toHaveTextContent(C.prompt.manual)
    const input = screen.getByRole('textbox', { name: C.prompt.label }) as HTMLTextAreaElement
    await waitFor(() => expect(input).toHaveFocus())
    expect(input.value).toBe(C.prompt.body)
    expect(input.selectionEnd - input.selectionStart).toBe(C.prompt.body.length)
  })
})
