import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PasskeyTwoFactorSettings } from '../PasskeyTwoFactorSettings'
import { AUTH } from '@/lib/marketing/copy/auth'

const mocks = vi.hoisted(() => ({ list: vi.fn(), add: vi.fn(), remove: vi.fn(), enable: vi.fn(), disable: vi.fn(), codes: vi.fn(),
  confirm: vi.fn(), refresh: vi.fn(), success: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('@/components/ui/confirm-dialog', () => ({ useConfirm: () => ({ confirm: mocks.confirm, confirmDialog: null }) }))
vi.mock('@/lib/auth-client', () => ({ authClient: {
  passkey: { listUserPasskeys: mocks.list, addPasskey: mocks.add, deletePasskey: mocks.remove },
  twoFactor: { enable: mocks.enable, disable: mocks.disable, generateBackupCodes: mocks.codes },
} }))
vi.mock('sonner', () => ({ toast: { success: mocks.success } }))
const C = AUTH.security
const status = { data: { status: true }, error: null }
const enrollment = { data: { method: 'totp', backupCodes: ['enrollment-code'] }, error: null }
const generated = { data: { status: true, backupCodes: ['replacement-code'] }, error: null }
type Action = 'enable' | 'disable' | 'remove' | 'codes'
const receipts = { enable: enrollment, disable: status, remove: status, codes: generated }
const failures = { enable: C.enableError, disable: C.disableError, remove: C.removeError, codes: C.backupCodesError }
const successes = { enable: C.enableSuccess, disable: C.disableSuccess, remove: C.removeSuccess, codes: C.backupCodesSuccess }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.list.mockResolvedValue({ data: [{ id: 'key-1' }], error: null })
  mocks.add.mockResolvedValue({ data: { id: 'new-key' }, error: null })
  mocks.confirm.mockResolvedValue(true)
  for (const action of Object.keys(receipts) as Action[]) mocks[action].mockResolvedValue(receipts[action])
})
afterEach(() => { cleanup(); vi.useRealTimers() })

async function mount(enabled = false) {
  let view!: ReturnType<typeof render>
  await act(async () => { view = render(<PasskeyTwoFactorSettings hasPassword twoFactorEnabled={enabled} />) })
  const password = screen.getByLabelText(C.passwordLabel)
  fireEvent.change(password, { target: { value: 'retained-password' } })
  return { ...view, password, form: password.closest('form')! }
}
function invoke(action: Action, form: HTMLFormElement) {
  if (action === 'remove') fireEvent.click(screen.getByRole('button', { name: C.deletePasskey }))
  else if (action === 'codes') fireEvent.click(screen.getByRole('button', { name: C.regenerateBackupCodes }))
  else fireEvent.submit(form)
}

it.each(['enable', 'disable', 'remove', 'codes'] as const)('bounds %s requests and ignores late receipts during an explicit retry', async action => {
  vi.useFakeTimers()
  let first!: (value: unknown) => void, second!: (value: unknown) => void
  mocks[action].mockImplementationOnce(() => new Promise(resolve => { first = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { second = resolve }))
  const { form, password } = await mount(action === 'disable' || action === 'codes')
  await act(async () => { invoke(action, form); invoke(action, form) })
  expect(mocks[action]).toHaveBeenCalledOnce()
  if (action === 'disable' || action === 'remove') expect(mocks.confirm).toHaveBeenCalledOnce()
  const signal = mocks[action].mock.calls[0][0].fetchOptions.signal as AbortSignal
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(signal.aborted).toBe(true)
  expect(screen.getByRole('alert')).toHaveTextContent(failures[action])
  expect(password).toHaveValue('retained-password')
  expect(password).toBeEnabled()
  expect(mocks.success).not.toHaveBeenCalled()
  await act(async () => { invoke(action, form) })
  expect(mocks[action]).toHaveBeenCalledTimes(2)
  await act(async () => { first(receipts[action]) })
  expect(mocks.success).not.toHaveBeenCalled()
  expect(password).toBeDisabled()
  await act(async () => { second(receipts[action]) })
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith(successes[action])
  expect(password).toBeEnabled()
  expect(vi.getTimerCount()).toBe(0)
})

it.each(['enable', 'disable', 'remove', 'codes'] as const)('does not publish a %s change from a malformed response or native rejection', async action => {
  mocks[action].mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce(new Error('Disconnected'))
  const { form, password } = await mount(action === 'disable' || action === 'codes')
  for (let attempt = 0; attempt < 2; attempt++) {
    await act(async () => { invoke(action, form) })
    expect(screen.getByRole('alert')).toHaveTextContent(failures[action])
    expect(password).toHaveValue('retained-password')
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(screen.getByText(action === 'disable' || action === 'codes' ? C.enabledBadge : C.disabledBadge)).toBeVisible()
  }
})

it.each([[], [''], ['same', 'same']])('requires usable new backup codes before announcing enrollment: %j', async backupCodes => {
  mocks.enable.mockResolvedValueOnce({ data: { method: 'totp', backupCodes }, error: null })
  const { form } = await mount()
  await act(async () => { fireEvent.submit(form) })
  expect(screen.getByRole('alert')).toHaveTextContent(C.enableError)
  expect(screen.getByText(C.disabledBadge)).toBeVisible()
  expect(mocks.success).not.toHaveBeenCalled()
})

it('retires previous backup codes as soon as a rotation is submitted', async () => {
  const { form } = await mount()
  await act(async () => { fireEvent.submit(form) })
  expect(screen.getByText('enrollment-code')).toBeVisible()
  mocks.success.mockClear()
  let finish!: (value: unknown) => void
  mocks.codes.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  fireEvent.click(screen.getByRole('button', { name: C.regenerateBackupCodes }))
  expect(screen.queryByText('enrollment-code')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: C.copyBackupCodes })).not.toBeInTheDocument()
  await act(async () => { finish({ data: null, error: null }) })
  expect(screen.getByRole('alert')).toHaveTextContent(C.backupCodesError)
  expect(mocks.success).not.toHaveBeenCalled()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: C.regenerateBackupCodes })) })
  expect(screen.getByText('replacement-code')).toBeVisible()
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith(C.backupCodesSuccess)
})

it('lets native passkey registration retain its timing while guarding overlapping submissions', async () => {
  vi.useFakeTimers()
  let finish!: (value: unknown) => void
  mocks.add.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const { form } = await mount()
  const add = screen.getByRole('button', { name: C.addPasskey })
  act(() => { fireEvent.click(add); fireEvent.click(add); fireEvent.submit(form) })
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(mocks.add).toHaveBeenCalledExactlyOnceWith()
  expect(mocks.enable).not.toHaveBeenCalled()
  expect(add).toBeDisabled()
  await act(async () => { finish({ data: { id: 'new-key' }, error: null }) })
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith(C.addSuccess)
  expect(add).toBeEnabled()
})

it('does not accept an unconfirmed native registration as a new passkey', async () => {
  mocks.add.mockResolvedValueOnce({ data: null, error: null })
  await mount()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: C.addPasskey })) })
  expect(screen.getByRole('alert')).toHaveTextContent(C.addError)
  expect(mocks.list).toHaveBeenCalledOnce()
  expect(mocks.success).not.toHaveBeenCalled()
})

it('cancels an owned HTTP command and ignores its receipt after leaving settings', async () => {
  let finish!: (value: unknown) => void
  mocks.enable.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = await mount()
  fireEvent.submit(view.form)
  const signal = mocks.enable.mock.calls[0][0].fetchOptions.signal as AbortSignal
  view.unmount()
  await act(async () => { finish(enrollment) })
  expect(signal.aborted).toBe(true)
  expect(mocks.success).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
})

it('selects the visible codes after clipboard refusal and permits an explicit copy retry', async () => {
  mocks.enable.mockResolvedValueOnce({ data: { method: 'totp', backupCodes: ['first-code', 'second-code'] }, error: null })
  const writeText = vi.fn().mockRejectedValueOnce(new Error('Clipboard refused')).mockResolvedValueOnce(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  const { form } = await mount()
  await act(async () => { fireEvent.submit(form) })
  mocks.success.mockClear()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: C.copyBackupCodes })) })
  expect(screen.getByRole('alert')).toHaveTextContent(C.backupCodesCopyError)
  expect(window.getSelection()?.toString()).toBe('first-code\nsecond-code')
  expect(document.activeElement?.tagName).toBe('PRE')
  expect(mocks.success).not.toHaveBeenCalled()
  expect(screen.getByText(C.enabledBadge)).toBeVisible()
  expect(screen.getByRole('button', { name: C.copyBackupCodes })).toBeEnabled()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: C.copyBackupCodes })) })
  expect(writeText).toHaveBeenNthCalledWith(1, 'first-code\nsecond-code')
  expect(writeText).toHaveBeenNthCalledWith(2, 'first-code\nsecond-code')
  expect(mocks.success).toHaveBeenCalledExactlyOnceWith(C.backupCodesCopied)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(mocks.codes).not.toHaveBeenCalled()
  expect(mocks.disable).not.toHaveBeenCalled()
})

it('bounds an unconfirmed clipboard write and prevents code rotation while copying', async () => {
  vi.useFakeTimers()
  let finish!: () => void
  const writeText = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  const { form } = await mount()
  await act(async () => { fireEvent.submit(form) })
  mocks.success.mockClear()
  const copy = screen.getByRole('button', { name: C.copyBackupCodes })
  act(() => { fireEvent.click(copy); fireEvent.click(copy); fireEvent.submit(form) })
  expect(writeText).toHaveBeenCalledExactlyOnceWith('enrollment-code')
  expect(screen.getByRole('button', { name: C.regenerateBackupCodes })).toBeDisabled()
  expect(mocks.disable).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
  expect(screen.getByRole('alert')).toHaveTextContent(C.backupCodesCopyError)
  expect(copy).toBeEnabled()
  expect(screen.getByRole('button', { name: C.regenerateBackupCodes })).toBeEnabled()
  await act(async () => { finish() })
  expect(mocks.success).not.toHaveBeenCalled()
  expect(window.getSelection()?.toString()).toBe('enrollment-code')
  // JSDOM dispatches the focus and selection changes on the next timer tick.
  await act(async () => { await vi.advanceTimersByTimeAsync(1) })
  expect(vi.getTimerCount()).toBe(0)
})
