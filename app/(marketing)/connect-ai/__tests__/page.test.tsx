import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConnectAiPage, { metadata } from '../page'
import { AI_CONNECTION_COPY as C } from '@/lib/marketing/copy/ai-connection'
import { buildEditorSetupPath } from '@/lib/integrations/editor-config'

// The gate is mocked so the closed state stays covered, but it defaults to the real value.
const gate = vi.hoisted(() => ({ available: true }))
vi.mock('@/lib/mcp/discoverability', () => ({ get MCP_IS_DISCOVERABLE() { return gate.available } }))
vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))

afterEach(() => {
  gate.available = true
  vi.unstubAllGlobals()
})

describe('AI connection explainer', () => {
  it('defaults to the real discovery gate, which is open', async () => {
    const real = await vi.importActual<typeof import('@/lib/mcp/discoverability')>('@/lib/mcp/discoverability')
    expect(real.MCP_IS_DISCOVERABLE).toBe(true)
    expect(gate.available).toBe(real.MCP_IS_DISCOVERABLE)
  })

  it('explains the value without promising zero token use for AI repairs', () => {
    render(<ConnectAiPage />)
    expect(screen.getByRole('heading', { level: 1, name: C.title })).toBeVisible()
    expect(screen.getByText(/Reading the results and making fixes with your AI still uses its tokens/)).toBeVisible()
    expect(metadata.alternates?.canonical).toMatch(/\/connect-ai$/)
  })

  it('offers setup, the steps, and key handling while discovery is open', () => {
    render(<ConnectAiPage />)
    expect(screen.getByRole('heading', { level: 2, name: C.connection.available.title })).toBeVisible()
    expect(screen.getByRole('link', { name: C.connection.available.action })).toHaveAttribute('href', buildEditorSetupPath('cursor'))
    for (const step of C.connection.available.steps) expect(screen.getByText(step)).toBeVisible()
    expect(screen.getByText(C.connection.privacy)).toBeVisible()
    expect(screen.getByText(C.connection.workBody)).toBeVisible()
    expect(screen.queryByRole('heading', { name: C.connection.unavailable.title })).not.toBeInTheDocument()
  })

  it('keeps the copy-and-paste path after the direct connection', () => {
    render(<ConnectAiPage />)
    const connection = screen.getByRole('heading', { level: 2, name: C.connection.available.title })
    const current = screen.getByRole('heading', { level: 2, name: C.current.title })
    expect(connection.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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

  it('falls back to copy and paste with no setup link if the gate is closed again', () => {
    gate.available = false
    render(<ConnectAiPage />)
    expect(screen.getByRole('heading', { name: C.connection.unavailable.title })).toBeVisible()
    expect(screen.getByRole('link', { name: C.connection.unavailable.action })).toHaveAttribute('href', '/docs/fix-with-ai')
    expect(screen.queryByRole('link', { name: C.connection.available.action })).not.toBeInTheDocument()
    expect(document.querySelector('a[href^="/dashboard/mcp-setup"]')).not.toBeInTheDocument()
  })
})
