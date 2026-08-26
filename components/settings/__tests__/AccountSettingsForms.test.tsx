import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { AUTH } from '@/lib/marketing/copy'

const refresh = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const authClient = vi.hoisted(() => ({
  updateUser: vi.fn(),
  changeEmail: vi.fn(),
  changePassword: vi.fn(),
  deleteUser: vi.fn(),
  sendVerificationEmail: vi.fn(),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
}))
vi.mock('@/lib/auth-client', () => ({ authClient }))
vi.mock('sonner', () => ({ toast }))

import { AccountSettingsForms } from '@/components/settings/AccountSettingsForms'

const ac = AUTH.settings.account

function renderAccount(overrides?: Partial<ComponentProps<typeof AccountSettingsForms>>) {
  return render(
    <AccountSettingsForms
      initialName="Saad Benryane"
      email="saadbenryane@gmail.com"
      emailVerified
      planName="Free"
      isPaid={false}
      {...overrides}
    />,
  )
}

describe('AccountSettingsForms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authClient.updateUser.mockResolvedValue({})
    authClient.changeEmail.mockResolvedValue({})
    authClient.changePassword.mockResolvedValue({})
    authClient.deleteUser.mockResolvedValue({})
  })

  it('shows the plan with an upgrade CTA and a single save action', () => {
    const { container } = renderAccount()

    expect(screen.getByText(ac.planLabel)).toBeInTheDocument()
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: ac.upgradeCta })).toHaveAttribute('href', '/pricing')
    expect(screen.getByRole('button', { name: ac.saveCta })).toBeDisabled()
    expect(screen.queryByText('Profile')).not.toBeInTheDocument()
    expect(container.querySelector('.shadow-card')).toBeNull()
  })

  it('links paid plans to billing', () => {
    renderAccount({ planName: 'Pro', isPaid: true })

    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: ac.managePlanCta })).toHaveAttribute('href', '/billing')
  })

  it('saves name, email, and password from one action', async () => {
    renderAccount()

    fireEvent.change(screen.getByRole('textbox', { name: ac.nameLabel }), {
      target: { value: 'Saad' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /Email address/ }), {
      target: { value: 'new@example.com' },
    })
    fireEvent.change(screen.getByLabelText(ac.currentPasswordLabel), {
      target: { value: 'old-pass-word' },
    })
    fireEvent.change(screen.getByLabelText(ac.newPasswordLabel), {
      target: { value: 'new-pass-word' },
    })

    fireEvent.click(screen.getByRole('button', { name: ac.saveCta }))

    await waitFor(() => {
      expect(authClient.updateUser).toHaveBeenCalledWith({ name: 'Saad' })
      expect(authClient.changeEmail).toHaveBeenCalledWith({
        newEmail: 'new@example.com',
        callbackURL: '/settings',
      })
      expect(authClient.changePassword).toHaveBeenCalledWith({
        currentPassword: 'old-pass-word',
        newPassword: 'new-pass-word',
        revokeOtherSessions: true,
      })
    })
    expect(toast.success).toHaveBeenCalledWith(ac.changeEmailSuccess)
    expect(screen.getByRole('button', { name: ac.saveCta })).toBeDisabled()
  })

  it('keeps delete confirmation in a modal', async () => {
    renderAccount()

    expect(screen.queryByLabelText(ac.deletePasswordLabel)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: ac.deleteCta }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(ac.deleteConfirmTitle)).toBeInTheDocument()
    expect(screen.getByLabelText(ac.deletePasswordLabel)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(ac.deletePasswordLabel), {
      target: { value: 'secret' },
    })
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: ac.deleteConfirmLabel }))

    await waitFor(() => {
      expect(authClient.deleteUser).toHaveBeenCalledWith({
        password: 'secret',
        callbackURL: '/',
      })
    })
  })

  it('warns before in-app navigation when there are unsaved changes', async () => {
    renderAccount()
    fireEvent.change(screen.getByRole('textbox', { name: ac.nameLabel }), {
      target: { value: 'Ada' },
    })

    const leave = document.createElement('a')
    leave.href = '/dashboard'
    leave.textContent = 'Dashboard'
    document.body.appendChild(leave)
    fireEvent.click(leave)

    expect(await screen.findByText(ac.unsavedTitle)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: ac.unsavedLeave }))
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/dashboard')
    })
    leave.remove()
  })
})
