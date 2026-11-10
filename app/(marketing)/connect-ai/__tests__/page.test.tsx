import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConnectAiPage, { metadata } from '../page'
import { AI_CONNECTION_COPY as C } from '@/lib/marketing/copy/ai-connection'
import { buildEditorSetupPath } from '@/lib/integrations/editor-config'

const gate = vi.hoisted(() => ({ available: false }))
vi.mock('@/lib/mcp/discoverability', () => ({ get MCP_IS_DISCOVERABLE() { return gate.available } }))
vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))

afterEach(() => {
  gate.available = false
  vi.unstubAllGlobals()
})

describe('AI connection explainer', () => {
  it('explains the value without promising zero token use for AI repairs', () => {
    render(<ConnectAiPage />)
    expect(screen.getByRole('heading', { level: 1, name: C.title })).toBeVisible()
    expect(screen.getByText(/Reading the results and making fixes with your AI still uses its tokens/)).toBeVisible()
    expect(metadata.alternates?.canonical).toMatch(/\/connect-ai$/)
  })

  it('keeps new setup unavailable while preserving a usable copy-and-paste path', () => {
    render(<ConnectAiPage />)
    expect(screen.getByRole('heading', { name: C.connection.unavailable.title })).toBeVisible()
    expect(screen.getByRole('link', { name: C.connection.unavailable.action })).toHaveAttribute('href', '/docs/fix-with-ai')
    expect(screen.queryByRole('link', { name: C.connection.available.action })).not.toBeInTheDocument()
    expect(document.querySelector('a[href^="/dashboard/mcp-setup"]')).not.toBeInTheDocument()
  })

  it('leads with the copy-and-paste path while direct connections are unavailable', () => {
    render(<ConnectAiPage />)
    const current = screen.getByRole('heading', { level: 2, name: C.current.title })
    const unavailable = screen.getByRole('heading', { level: 2, name: C.connection.unavailable.title })
    expect(current.compareDocumentPosition(unavailable) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('copies only a connection check for an existing client, without starting work', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(<ConnectAiPage />)
    fireEvent.click(screen.getByText(C.connection.unavailable.existing, { selector: 'summary' }))
    fireEvent.click(screen.getByRole('button', { name: C.prompt.copy }))
    expect(await screen.findByRole('status')).toHaveTextContent(C.prompt.copied)
    expect(writeText).toHaveBeenCalledWith(C.prompt.body)
    expect(C.prompt.body).toContain('Do not start a check or record a fix.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('selects the readable prompt when copying is blocked', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<ConnectAiPage />)
    fireEvent.click(screen.getByText(C.connection.unavailable.existing, { selector: 'summary' }))
    fireEvent.click(screen.getByRole('button', { name: C.prompt.copy }))
    expect(await screen.findByRole('status')).toHaveTextContent(C.prompt.manual)
    const input = screen.getByRole('textbox', { name: C.prompt.label }) as HTMLTextAreaElement
    await waitFor(() => expect(input).toHaveFocus())
    expect(input.value).toBe(C.prompt.body)
    expect(input.selectionEnd - input.selectionStart).toBe(C.prompt.body.length)
  })

  it('offers setup and permissions only when connection discovery is enabled', () => {
    gate.available = true
    render(<ConnectAiPage />)
    expect(screen.getByRole('link', { name: C.connection.available.action })).toHaveAttribute('href', buildEditorSetupPath('cursor'))
    expect(screen.getByText(C.connection.privacy)).toBeVisible()
    expect(screen.getByText(C.connection.workBody)).toBeVisible()
    expect(screen.queryByRole('heading', { name: C.connection.unavailable.title })).not.toBeInTheDocument()
  })
})
