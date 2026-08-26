// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PromptCopyButton } from '../PromptCopyButton'

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))

describe('PromptCopyButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('records a handoff without claiming acceptance or creating an attempt', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ attempt: { action: 'HANDOFF_COPIED', attemptId: null } }), {
        status: 201,
      }),
    )
    render(
      <PromptCopyButton
        prompt="Update the headline with a specific customer outcome."
        flagId="flag-1"
        accessState="owner"
        tool="cursor"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/flags/flag-1/attempts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ builder: 'cursor', action: 'HANDOFF_COPIED' }),
      }),
    ))
  })

  it('does not copy when the locked action runs instead', () => {
    const onLockedAction = vi.fn()
    render(
      <PromptCopyButton prompt="" onLockedAction={onLockedAction} variant="brand" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    expect(onLockedAction).toHaveBeenCalledOnce()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })
})
