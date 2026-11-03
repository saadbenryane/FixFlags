import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { McpSetup } from '../McpSetup'
import { MCP_SETUP_COPY as C } from '@/lib/marketing/copy/mcp-setup'

describe('guided MCP setup', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
  })
  it('honors the selected agent and changes the single configuration and instructions', async () => {
    render(<McpSetup initialEditor="codex" />)
    await screen.findByText('No active keys.')
    expect(screen.getByRole('heading', { level: 2, name: C.keyTitle })).toBeVisible()
    expect(screen.getByRole('heading', { level: 3, name: 'Active keys' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: C.editor })).toHaveValue('codex')
    expect(screen.getAllByRole('textbox', { name: C.configLabel })).toHaveLength(1)
    expect((screen.getByRole('textbox', { name: C.configLabel }) as HTMLTextAreaElement).value).toContain('bearer_token_env_var')
    expect(screen.getByText(C.environment('Codex'))).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: C.editor }), { target: { value: 'lovable' } })
    expect((screen.getByRole('textbox', { name: C.configLabel }) as HTMLTextAreaElement).value).toContain('Transport: Streamable HTTP')
    expect(screen.getByText(C.hosted)).toBeInTheDocument()
    expect(screen.queryByText(C.environment('Codex'))).not.toBeInTheDocument()
  })
  it('copies a read-only first-use check without claiming the connection is already verified', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<McpSetup />)
    await screen.findByText('No active keys.')
    fireEvent.click(screen.getByRole('button', { name: `${C.copy} ${C.verifyLabel}` }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(C.verifyPrompt))
    expect(C.verifyPrompt).toContain('Do not start a check or record a fix')
    expect(screen.getByText(C.privacy)).toBeInTheDocument()
  })
  it('selects configuration for manual copy when the clipboard is unavailable', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<McpSetup />)
    await screen.findByText('No active keys.')
    fireEvent.click(screen.getByRole('button', { name: `${C.copy} ${C.configLabel}` }))
    expect(await screen.findByText(C.manualCopy)).toBeInTheDocument()
    const input = screen.getByRole('textbox', { name: C.configLabel })
    expect(input).toHaveFocus()
    expect(input).toHaveProperty('selectionStart', 0)
    expect(input).toHaveProperty('selectionEnd', (input as HTMLTextAreaElement).value.length)
  })
})
