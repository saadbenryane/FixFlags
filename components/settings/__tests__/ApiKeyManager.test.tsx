import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createApiKey = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/api-key-client', () => ({ createApiKey }))

import { ApiKeyManager } from '@/components/settings/ApiKeyManager'

function response(body: unknown) {
  return { ok: true, json: async () => body }
}

describe('ApiKeyManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([])))
    createApiKey.mockResolvedValue({
      id: 'key-1',
      name: 'Release agent',
      key: 'ff_live_secret_once',
      prefix: 'ff_live_abc',
      lastFour: '1234',
      client: 'codex',
      scopes: ['sites:read', 'runs:read', 'runs:write', 'flags:read', 'flags:write'],
      expiresAt: '2026-11-04T00:00:00.000Z',
    })
  })

  it('creates a Fix and verify key without asking for an implementation client', async () => {
    render(<ApiKeyManager />)
    await screen.findByText('No active keys.')

    expect(screen.queryByRole('combobox', { name: /Access/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Client/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Fix and verify/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Expires after/ })).toHaveValue('90')
    fireEvent.change(screen.getByRole('textbox', { name: /Key name/ }), { target: { value: 'Release agent' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }))

    await waitFor(() => {
      expect(createApiKey).toHaveBeenCalledWith({
        name: 'Release agent',
        client: 'other',
        scopePreset: 'fix_and_verify',
        expiresInDays: 90,
      })
    })
    expect(await screen.findByRole('textbox', { name: 'New API key' })).toHaveValue('ff_live_secret_once')
    expect(screen.getByText('Key created. Copy it now. FixFlags will not show it again.')).toBeInTheDocument()
  })

  it('selects the revealed key when the browser blocks copying', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.assign(navigator, { clipboard: { writeText } })
    render(<ApiKeyManager />)
    await screen.findByText('No active keys.')
    fireEvent.change(screen.getByRole('textbox', { name: /Key name/ }), { target: { value: 'Release agent' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }))
    const key = await screen.findByRole('textbox', { name: 'New API key' })
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByText('Copy was blocked by this browser. The key is selected so you can copy it manually.')).toBeInTheDocument()
    expect(key).toHaveFocus()
    expect(key).toHaveProperty('selectionStart', 0)
    expect(key).toHaveProperty('selectionEnd', 'ff_live_secret_once'.length)
  })

  it('lets the customer choose expiration without configuring scopes', async () => {
    render(<ApiKeyManager />)
    await screen.findByText('No active keys.')

    fireEvent.change(screen.getByRole('combobox', { name: /Expires after/ }), {
      target: { value: '30' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /Key name/ }), { target: { value: 'CI release' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }))

    await waitFor(() => {
      expect(createApiKey).toHaveBeenCalledWith(
        expect.objectContaining({
          scopePreset: 'fix_and_verify',
          expiresInDays: 30,
        })
      )
    })
  })
})
