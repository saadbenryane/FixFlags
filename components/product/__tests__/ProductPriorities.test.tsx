import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductPriorities } from '@/components/product/ProductPriorities'
import type { ProductAttentionItemDTO } from '@/lib/products/workspace'

const items: ProductAttentionItemDTO[] = Array.from({ length: 6 }, (_, index) => ({
  id: `i${index + 1}`,
  title: `Priority issue ${index + 1}`,
  judgment: `Consequence ${index + 1}`,
  recommendedChange: `Improve ${index + 1}`,
  successCondition: `Check ${index + 1}`,
  priority: 100 - index,
  status: 'PROPOSED',
  evidence: `Evidence ${index + 1}`,
  rubric: 'EXPERIENCE',
  severity: 'IMPORTANT',
  sourceReviewId: 'review-1',
  sourceFlagId: `flag-${index + 1}`,
  prompt: `Fix issue ${index + 1}`,
}))

afterEach(() => vi.unstubAllGlobals())

describe('ProductPriorities', () => {
  it('shows five ranked issues, expands the list, and selects detail', () => {
    render(<ProductPriorities items={items} />)
    expect(screen.queryByText('Priority issue 6')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show more/i }))
    fireEvent.click(screen.getByRole('button', { name: /Priority issue 6/i }))
    expect(screen.getByRole('heading', { name: 'Priority issue 6' })).toBeInTheDocument()
    expect(screen.getByText('Evidence 6')).toBeInTheDocument()
  })

  it('copies through the owner handoff path', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    Object.assign(navigator, { clipboard: { writeText } })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProductPriorities items={items.slice(0, 1)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Fix issue 1'))
    expect(fetchMock).toHaveBeenCalledWith('/api/flags/flag-1/attempts', expect.objectContaining({ method: 'POST' }))
  })
})
