import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { AUTH } from '@/lib/marketing/copy-barrel'
import { clearSettingsDrafts } from '@/lib/settings/drafts'

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

import { AccountDangerZone, AccountSettingsForms, PasswordSettings } from '@/components/settings/AccountSettingsForms'

const ac = AUTH.settings.account
const confirmed = { data: { status: true }, error: null }
const passwordConfirmed = { data: { user: { id: 'account-owner' }, token: 'new-session' }, error: null }
const deletionConfirmed = { data: { success: true, message: 'Verification email sent' }, error: null }

function openSecurityForm(kind: 'password' | 'deletion') {
  if (kind === 'password') {
    render(<PasswordSettings hasPassword />)
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    const field = screen.getByLabelText(ac.currentPasswordLabel)
    fireEvent.change(field, { target: { value: 'current-password' } })
    fireEvent.change(screen.getByLabelText(ac.newPasswordLabel), { target: { value: 'replacement-password' } })
    return { field, request: authClient.changePassword, receipt: passwordConfirmed,
      send: () => fireEvent.submit(field.closest('form')!), success: ac.changePasswordSuccess }
  }
  render(<AccountDangerZone />)
  fireEvent.click(screen.getByRole('button', { name: ac.deleteCta }))
  const field = screen.getByLabelText(ac.deletePasswordLabel)
  fireEvent.change(field, { target: { value: 'current-password' } })
  return { field, request: authClient.deleteUser, receipt: deletionConfirmed,
    send: () => fireEvent.click(screen.getByRole('button', { name: ac.deleteConfirmLabel })), success: ac.deleteSuccess }
}

function renderAccount(overrides?: Partial<ComponentProps<typeof AccountSettingsForms>>) {
  return render(
    <AccountSettingsForms
      ownerId="account-owner"
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
    clearSettingsDrafts()
    vi.clearAllMocks()
    authClient.updateUser.mockResolvedValue(confirmed)
    authClient.changeEmail.mockResolvedValue(confirmed)
    authClient.sendVerificationEmail.mockResolvedValue(confirmed)
    authClient.changePassword.mockResolvedValue(passwordConfirmed)
    authClient.deleteUser.mockResolvedValue(deletionConfirmed)
  })
  afterEach(() => { cleanup(); vi.useRealTimers() })

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

  it('does not give an edited email address the current address’s verified status', () => {
    renderAccount()
    const field = screen.getByRole('textbox', { name: /Email address/ })
    expect(screen.getByText(ac.verified)).toBeVisible()
    fireEvent.change(field, { target: { value: 'new@example.com' } })
    expect(screen.getByText(ac.notVerified)).toBeVisible()
    expect(screen.queryByText(ac.verified)).not.toBeInTheDocument()
    fireEvent.change(field, { target: { value: 'saadbenryane@gmail.com' } })
    expect(screen.getByText(ac.verified)).toBeVisible()
    expect(screen.queryByText(ac.notVerified)).not.toBeInTheDocument()
  })

  it('does not send verification to the previous address while a different email is displayed', async () => {
    renderAccount({ emailVerified: false })
    const field = screen.getByRole('textbox', { name: /Email address/ })
    const send = screen.getByRole('button', { name: ac.verifyCta })
    expect(send).toBeEnabled()
    fireEvent.change(field, { target: { value: 'new@example.com' } })
    expect(send).toBeDisabled()
    fireEvent.click(send)
    expect(authClient.sendVerificationEmail).not.toHaveBeenCalled()
    fireEvent.change(field, { target: { value: 'saadbenryane@gmail.com' } })
    expect(send).toBeEnabled()
    fireEvent.click(send)
    await waitFor(() => expect(authClient.sendVerificationEmail).toHaveBeenCalledExactlyOnceWith({
      email: 'saadbenryane@gmail.com', callbackURL: '/settings', fetchOptions: { signal: expect.any(AbortSignal) },
    }))
  })

  it('waits for the server to verify a changed address after accepting the change request', async () => {
    const page = renderAccount()
    const field = screen.getByRole('textbox', { name: /Email address/ })
    fireEvent.change(field, { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: ac.saveCta }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(ac.changeEmailSuccess))
    expect(field).toHaveValue('new@example.com')
    expect(screen.getByText(ac.notVerified)).toBeVisible()
    expect(screen.queryByText(ac.verified)).not.toBeInTheDocument()
    const props = { ownerId: 'account-owner', initialName: 'Saad Benryane', email: 'new@example.com', planName: 'Free', isPaid: false }
    page.rerender(<AccountSettingsForms {...props} emailVerified={false} />)
    expect(screen.getByText(ac.notVerified)).toBeVisible()
    page.rerender(<AccountSettingsForms {...props} emailVerified />)
    expect(screen.getByText(ac.verified)).toBeVisible()
    expect(screen.queryByText(ac.notVerified)).not.toBeInTheDocument()
  })

  it('saves profile changes from one action', async () => {
    renderAccount()

    fireEvent.change(screen.getByRole('textbox', { name: ac.nameLabel }), {
      target: { value: 'Saad' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: /Email address/ }), {
      target: { value: 'new@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: ac.saveCta }))

    await waitFor(() => {
      expect(authClient.updateUser).toHaveBeenCalledWith({ name: 'Saad', fetchOptions: { signal: expect.any(AbortSignal) } })
      expect(authClient.changeEmail).toHaveBeenCalledWith({
        newEmail: 'new@example.com',
        callbackURL: '/settings',
        fetchOptions: { signal: expect.any(AbortSignal) },
      })
    })
    expect(toast.success).toHaveBeenCalledWith(ac.changeEmailSuccess)
    expect(screen.getByRole('button', { name: ac.saveCta })).toBeDisabled()
  })

  it('keeps an unconfirmed email edit while preserving a confirmed name on retry', async () => {
    authClient.changeEmail.mockResolvedValueOnce({ data: { status: false }, error: null })
      .mockResolvedValueOnce(confirmed)
    renderAccount()
    fireEvent.change(screen.getByRole('textbox', { name: ac.nameLabel }), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Email address/ }), { target: { value: 'ada@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: ac.saveCta }))
    expect(await screen.findByRole('alert')).toHaveTextContent(ac.errorFallback)
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: ac.nameLabel })).toHaveValue('Ada')
    expect(screen.getByRole('textbox', { name: /Email address/ })).toHaveValue('ada@example.com')
    fireEvent.click(screen.getByRole('button', { name: ac.saveCta }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(ac.changeEmailSuccess))
    expect(authClient.updateUser).toHaveBeenCalledTimes(1)
    expect(authClient.changeEmail).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: ac.saveCta })).toBeDisabled()
  })

  it.each([{}, { data: null }, { data: {} }, { data: { status: false } }])('retains a name draft for an incomplete success receipt: %j', async receipt => {
    authClient.updateUser.mockResolvedValueOnce(receipt)
    renderAccount()
    fireEvent.change(screen.getByRole('textbox', { name: ac.nameLabel }), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByRole('button', { name: ac.saveCta }))
    expect(await screen.findByRole('alert')).toHaveTextContent(ac.errorFallback)
    expect(screen.getByRole('textbox', { name: ac.nameLabel })).toHaveValue('Ada')
    expect(screen.getByRole('button', { name: ac.saveCta })).toBeEnabled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each(['name', 'email', 'verification'] as const)('releases an interrupted %s request and ignores its late receipt during retry', async kind => {
    vi.useFakeTimers()
    const request = kind === 'name' ? authClient.updateUser : kind === 'email' ? authClient.changeEmail : authClient.sendVerificationEmail
    let first!: (value: typeof confirmed) => void, retry!: (value: typeof confirmed) => void
    request.mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
      .mockImplementationOnce(() => new Promise(resolve => { retry = resolve }))
    renderAccount({ emailVerified: false })
    const name = screen.getByRole('textbox', { name: ac.nameLabel })
    const email = screen.getByRole('textbox', { name: /Email address/ })
    if (kind === 'name') fireEvent.change(name, { target: { value: 'Retained name' } })
    if (kind === 'email') fireEvent.change(email, { target: { value: 'retained@example.com' } })
    const submit = () => kind === 'verification' ? fireEvent.click(screen.getByRole('button', { name: ac.verifyCta })) : fireEvent.submit(name.closest('form')!)
    act(() => { submit(); submit() })
    expect(request).toHaveBeenCalledTimes(1)
    const signal = request.mock.calls[0][0].fetchOptions.signal as AbortSignal
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(signal.aborted).toBe(true)
    expect(screen.getByRole('alert')).toHaveTextContent(ac.errorFallback)
    expect(name).toHaveValue(kind === 'name' ? 'Retained name' : 'Saad Benryane')
    expect(email).toHaveValue(kind === 'email' ? 'retained@example.com' : 'saadbenryane@gmail.com')
    act(() => { submit() })
    expect(request).toHaveBeenCalledTimes(2)
    await act(async () => { first(confirmed) })
    expect(toast.success).not.toHaveBeenCalled()
    expect(name).toBeDisabled()
    await act(async () => { retry(confirmed) })
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(kind === 'verification' ? ac.verifySuccess : kind === 'email' ? ac.changeEmailSuccess : ac.saveSuccess)
    expect(name).toBeEnabled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shows a refused verification-link request and permits an explicit retry', async () => {
    authClient.sendVerificationEmail.mockRejectedValueOnce(new Error('Connection refused')).mockResolvedValueOnce(confirmed)
    renderAccount({ emailVerified: false })
    fireEvent.click(screen.getByRole('button', { name: ac.verifyCta }))
    expect(await screen.findByRole('alert')).toHaveTextContent(ac.errorFallback)
    expect(toast.success).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: ac.verifyCta }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(ac.verifySuccess))
    expect(authClient.sendVerificationEmail).toHaveBeenCalledTimes(2)
  })

  it('keeps delete confirmation in a modal', async () => {
    render(<AccountDangerZone />)

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
        fetchOptions: { signal: expect.any(AbortSignal) },
      })
    })
  })

  it('reveals and changes a password only after the customer asks', async () => {
    render(<PasswordSettings hasPassword />)
    expect(screen.queryByLabelText(ac.currentPasswordLabel)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    fireEvent.change(screen.getByLabelText(ac.currentPasswordLabel), { target: { value: 'old-pass-word' } })
    fireEvent.change(screen.getByLabelText(ac.newPasswordLabel), { target: { value: 'new-pass-word' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Change password' }).at(-1)!)
    await waitFor(() => expect(authClient.changePassword).toHaveBeenCalledWith({ currentPassword: 'old-pass-word', newPassword: 'new-pass-word', revokeOtherSessions: true, fetchOptions: { signal: expect.any(AbortSignal) } }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(ac.changePasswordSuccess))
    expect(screen.queryByLabelText(ac.currentPasswordLabel)).not.toBeInTheDocument()
  })

  it('discards both password fields when the customer cancels a password change', () => {
    render(<PasswordSettings hasPassword />)
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    fireEvent.change(screen.getByLabelText(ac.currentPasswordLabel), { target: { value: 'old-secret-password' } })
    fireEvent.change(screen.getByLabelText(ac.newPasswordLabel), { target: { value: 'replacement-secret-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByLabelText(ac.currentPasswordLabel)).toHaveValue('')
    expect(screen.getByLabelText(ac.newPasswordLabel)).toHaveValue('')
    expect(authClient.changePassword).not.toHaveBeenCalled()
  })

  it.each(['cancel', 'close', 'escape'])('discards the deletion password when the dialog is dismissed with %s', async method => {
    render(<AccountDangerZone />)
    fireEvent.click(screen.getByRole('button', { name: ac.deleteCta }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(screen.getByLabelText(ac.deletePasswordLabel), { target: { value: 'deletion-secret-password' } })
    if (method === 'escape') fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' })
    else fireEvent.click(within(dialog).getByRole('button', { name: method === 'cancel' ? ac.deleteCancel : 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: ac.deleteCta }))
    expect(await screen.findByLabelText(ac.deletePasswordLabel)).toHaveValue('')
    expect(authClient.deleteUser).not.toHaveBeenCalled()
  })

  it('keeps pending deletion feedback but does not restore a password discarded during that request', async () => {
    let finish!: (value: unknown) => void
    authClient.deleteUser.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    render(<AccountDangerZone />)
    fireEvent.click(screen.getByRole('button', { name: ac.deleteCta }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(screen.getByLabelText(ac.deletePasswordLabel), { target: { value: 'deletion-secret-password' } })
    fireEvent.click(within(dialog).getByRole('button', { name: ac.deleteConfirmLabel }))
    fireEvent.click(within(dialog).getByRole('button', { name: ac.deleteCancel }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: ac.deleteCta })).toBeDisabled()
    await act(async () => { finish({ data: null, error: { message: 'The request could not be completed.' } }) })
    expect(screen.getByRole('alert')).toHaveTextContent('The request could not be completed.')
    fireEvent.click(screen.getByRole('button', { name: ac.deleteCta }))
    expect(await screen.findByLabelText(ac.deletePasswordLabel)).toHaveValue('')
    expect(authClient.deleteUser).toHaveBeenCalledOnce()
  })

  it.each(['password', 'deletion'] as const)('releases a stalled %s request without letting a late success retire a retry', async kind => {
    vi.useFakeTimers()
    const request = kind === 'password' ? authClient.changePassword : authClient.deleteUser
    let first!: (value: unknown) => void, retry!: (value: unknown) => void
    request.mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
      .mockImplementationOnce(() => new Promise(resolve => { retry = resolve }))
    const form = openSecurityForm(kind)
    act(() => { form.send(); form.send() })
    expect(request).toHaveBeenCalledTimes(1)
    expect(form.field).toBeDisabled()
    const signal = request.mock.calls[0][0].fetchOptions.signal as AbortSignal
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(signal.aborted).toBe(true)
    expect(screen.getByRole('alert')).toHaveTextContent(ac.errorFallback)
    if (kind === 'deletion') expect(within(screen.getByRole('dialog')).getByRole('alert')).toBeVisible()
    expect(form.field).toHaveValue('current-password')
    expect(form.field).toBeEnabled()
    act(() => { form.send() })
    expect(request).toHaveBeenCalledTimes(2)
    await act(async () => { first(form.receipt) })
    expect(toast.success).not.toHaveBeenCalled()
    expect(form.field).toBeDisabled()
    await act(async () => { retry(form.receipt) })
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(form.success)
    expect(form.field).not.toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['password', 'deletion'] as const)('retains the %s form after incomplete responses and native request failures', async kind => {
    const request = kind === 'password' ? authClient.changePassword : authClient.deleteUser
    request.mockResolvedValueOnce({ data: {} })
      .mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValueOnce(kind === 'password' ? passwordConfirmed : deletionConfirmed)
    const form = openSecurityForm(kind)
    form.send()
    expect(await screen.findByRole('alert')).toHaveTextContent(ac.errorFallback)
    expect(form.field).toHaveValue('current-password')
    expect(form.field).toBeEnabled()
    expect(toast.success).not.toHaveBeenCalled()
    form.send()
    await waitFor(() => expect(form.field).toBeEnabled())
    expect(screen.getByRole('alert')).toHaveTextContent(ac.errorFallback)
    expect(toast.success).not.toHaveBeenCalled()
    form.send()
    await waitFor(() => expect(toast.success).toHaveBeenCalledExactlyOnceWith(form.success))
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('does not describe a completed deletion as a confirmation email', async () => {
    authClient.deleteUser.mockResolvedValueOnce({ data: { success: true, message: 'User deleted' }, error: null })
    const form = openSecurityForm('deletion')
    form.send()
    expect(await screen.findByRole('alert')).toHaveTextContent(ac.errorFallback)
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeVisible()
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
