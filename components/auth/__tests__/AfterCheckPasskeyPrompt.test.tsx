import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AfterCheckPasskeyPrompt } from '../AfterCheckPasskeyPrompt'

const discover = vi.hoisted(() => vi.fn())
vi.mock('../PasskeyEnrollPrompt', () => ({ shouldShowPasskeyEnroll: (...args: unknown[]) => discover(...args),
  PasskeyEnrollPrompt: ({ onComplete }: { onComplete: () => void }) => <button onClick={onComplete}>Maybe later</button> }))
beforeEach(() => { sessionStorage.clear(); discover.mockReset() })

it('retires optional discovery when the completed-check view is left', async () => {
  let finish!: (show: boolean) => void
  discover.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve }))
  const view = render(<AfterCheckPasskeyPrompt ownerId="owner" />)
  const signal = discover.mock.calls[0][0] as AbortSignal
  view.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => { finish(true) })
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('respects dismissal for this owner without suppressing another owner’s suggestion', async () => {
  discover.mockResolvedValue(true)
  const first = render(<AfterCheckPasskeyPrompt ownerId="first" />)
  fireEvent.click(await screen.findByRole('button', { name: 'Maybe later' }))
  first.unmount()
  const again = render(<AfterCheckPasskeyPrompt ownerId="first" />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(discover).toHaveBeenCalledOnce()
  again.unmount()
  render(<AfterCheckPasskeyPrompt ownerId="second" />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Maybe later' })).toBeVisible())
  expect(discover).toHaveBeenCalledTimes(2)
})
