import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DocsCodeBlock } from '../DocsCodeBlock'

const clipboard = vi.hoisted(() => ({ writeText: vi.fn() }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const trackEvent = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('navigator', { clipboard })
})
afterEach(() => vi.unstubAllGlobals())

describe('documentation code copying', () => {
  it('copies the exact code and confirms success without recording a repair handoff', async () => {
    clipboard.writeText.mockResolvedValue(undefined)
    render(<DocsCodeBlock code={'const answer = 42\n'} label="JavaScript" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy JavaScript' }))
    await screen.findByText('Copied')
    expect(clipboard.writeText).toHaveBeenCalledWith('const answer = 42\n')
    expect(toast.success).toHaveBeenCalledWith('Copied to clipboard', undefined)
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('reports denied clipboard access without claiming the code was copied', async () => {
    clipboard.writeText.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
    render(<DocsCodeBlock code="const answer = 42" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy Code' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not copy to clipboard'))
    expect(screen.queryByText('Copied')).not.toBeInTheDocument()
    expect(screen.getByText('const answer = 42')).toBeVisible()
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('does not offer an empty code block as a successful copy', () => {
    render(<DocsCodeBlock code="   " />)
    expect(screen.getByRole('button', { name: 'Copy Code' })).toBeDisabled()
    expect(clipboard.writeText).not.toHaveBeenCalled()
  })
})
