import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH } from '@/lib/marketing/copy'

const refresh = vi.hoisted(() => vi.fn())
const authClient = vi.hoisted(() => ({
  passkey: {
    listUserPasskeys: vi.fn(),
    addPasskey: vi.fn(),
    deletePasskey: vi.fn(),
  },
  twoFactor: {
    enable: vi.fn(),
    disable: vi.fn(),
    generateBackupCodes: vi.fn(),
  },
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}))
vi.mock('@/lib/auth-client', () => ({ authClient }))
vi.mock('sonner', () => ({ toast }))

import { ConnectedAccounts } from '@/components/settings/ConnectedAccounts'

describe('ConnectedAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authClient.passkey.listUserPasskeys.mockResolvedValue({ data: [], error: null })
    authClient.passkey.addPasskey.mockResolvedValue({ error: null })
  })

  it('merges passkeys and two-factor into sign-in methods without a passkey name field', async () => {
    render(
      <ConnectedAccounts
        email="saadbenryane@gmail.com"
        emailVerified
        hasPassword={false}
        passkeyCount={0}
        linkedProviders={['google']}
        twoFactorEnabled={false}
      />,
    )

    expect(screen.getByText(AUTH.connectedAccounts.title)).toBeInTheDocument()
    expect(screen.getByText(AUTH.connectedAccounts.google)).toBeInTheDocument()
    expect(screen.getByText(AUTH.connectedAccounts.signedInVia('Google'))).toBeInTheDocument()
    expect(screen.queryByLabelText(/passkey name/i)).not.toBeInTheDocument()
    expect(await screen.findByText(AUTH.security.passkeysEmpty)).toBeInTheDocument()
    expect(screen.getByText(AUTH.security.enableTitle)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: AUTH.security.addPasskey }))
    await waitFor(() => {
      expect(authClient.passkey.addPasskey).toHaveBeenCalled()
      expect(authClient.passkey.addPasskey.mock.calls[0]?.[0]).toBeUndefined()
    })
  })

  it('labels existing passkeys as Passkey instead of a custom name', async () => {
    authClient.passkey.listUserPasskeys.mockResolvedValue({
      data: [
        {
          id: 'pk_1',
          name: 'Work laptop',
          createdAt: '2026-05-12T12:00:00.000Z',
          backedUp: true,
        },
      ],
      error: null,
    })

    render(
      <ConnectedAccounts
        email="saadbenryane@gmail.com"
        emailVerified
        hasPassword
        passkeyCount={1}
        linkedProviders={['google']}
        twoFactorEnabled
      />,
    )

    expect(await screen.findByText(AUTH.security.passkeyItem)).toBeInTheDocument()
    expect(screen.queryByText('Work laptop')).not.toBeInTheDocument()
    expect(screen.getByText(AUTH.security.enabledBadge)).toBeInTheDocument()
  })
})
