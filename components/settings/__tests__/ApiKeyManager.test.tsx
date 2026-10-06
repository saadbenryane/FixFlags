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

  it('defaults to read-only access and sends an explicit expiry', async () => {
    render(<ApiKeyManager />)
    await screen.findByText('No active keys.')

    expect(screen.getByRole('combobox', { name: /Access/ })).toHaveValue('read_only')
    expect(screen.getByRole('combobox', { name: /Expires after/ })).toHaveValue('90')
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }))

    await waitFor(() => {
      expect(createApiKey).toHaveBeenCalledWith({
        name: 'My coding agent',
        client: 'codex',
        scopePreset: 'read_only',
        expiresInDays: 90,
      })
    })
    expect(await screen.findByText('ff_live_secret_once')).toBeInTheDocument()
    expect(screen.getByText('Key created. Copy it now. FixFlags will not show it again.')).toBeInTheDocument()
  })

  it('makes complete write access a visible opt-in', async () => {
    render(<ApiKeyManager />)
    await screen.findByText('No active keys.')

    fireEvent.change(screen.getByRole('combobox', { name: /Access/ }), {
      target: { value: 'fix_and_verify' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /Expires after/ }), {
      target: { value: '30' },
    })
    expect(screen.getByText(/complete Flag → Fix → Verify workflow/)).toBeInTheDocument()
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
