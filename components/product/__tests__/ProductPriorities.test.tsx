import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductPriorities } from '@/components/product/ProductPriorities'
import type { ProductAttentionItemDTO } from '@/lib/products/workspace'

function attentionItem(
  index: number,
  overrides: Partial<ProductAttentionItemDTO> = {}
): ProductAttentionItemDTO {
  return {
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
    checkId: `check-${index + 1}`,
    pageUrl: 'https://example.com/pricing',
    pageUrls: ['https://example.com/pricing'],
    impactTag: 'conversion',
    source: 'AI',
    evidenceTargets: null,
    sourceReviewId: 'review-1',
    sourceFlagId: `flag-${index + 1}`,
    prompt: `Fix issue ${index + 1}`,
    ...overrides,
  }
}

const items = Array.from({ length: 6 }, (_, index) => attentionItem(index))

const attentionEvidence = {
  'review-1': {
    displayHost: 'example.com',
    desktopScreenshot: '/api/screenshots/desktop.webp',
    mobileScreenshot: '/api/screenshots/mobile.webp',
    visuals: {},
  },
}

afterEach(() => vi.unstubAllGlobals())

describe('ProductPriorities', () => {
  it('shows five ranked issues, expands the list, and selects detail', () => {
    render(
      <ProductPriorities items={items} attentionEvidence={attentionEvidence} />
    )
    expect(screen.queryByText('Priority issue 6')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show more/i }))
    fireEvent.click(screen.getByRole('button', { name: /Priority issue 6/i }))
    expect(
      screen.getByRole('heading', { name: 'Priority issue 6' })
    ).toBeInTheDocument()
    expect(screen.getByText(/Evidence 6/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View report' })).toHaveAttribute(
      'href',
      '/report/review-1?view=report&flag=flag-6'
    )
  })

  it('does not show Show more when exactly five priorities are open', () => {
    render(
      <ProductPriorities
        items={items.slice(0, 5)}
        attentionEvidence={attentionEvidence}
      />
    )
    expect(
      screen.queryByRole('button', { name: /show more/i })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Priority issue 5')).toBeInTheDocument()
  })

  it('renders source-review screenshots in the detail pane', () => {
    render(
      <ProductPriorities
        items={items.slice(0, 1)}
        attentionEvidence={attentionEvidence}
      />
    )
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0)
  })

  it('copies through the owner handoff path', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    Object.assign(navigator, { clipboard: { writeText } })
    vi.stubGlobal('fetch', fetchMock)
    render(
      <ProductPriorities
        items={items.slice(0, 1)}
        attentionEvidence={attentionEvidence}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Fix issue 1'))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/flags/flag-1/attempts',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('uses the report Flag list and prompt chrome without card shell', () => {
    const { container } = render(
      <ProductPriorities
        items={items.slice(0, 1)}
        attentionEvidence={attentionEvidence}
        productUrl="https://example.com"
      />
    )
    expect(screen.getByRole('list', { name: 'Report Flags' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fix Prompt' })).toBeInTheDocument()
    expect(screen.getByText('What this means')).toBeInTheDocument()
    expect(container.querySelector('.rounded-card.bg-card.shadow-card')).toBeNull()
  })

  it('copies every open priority from the Copy All Prompts chevron', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(
      <ProductPriorities
        items={items.slice(0, 2)}
        attentionEvidence={attentionEvidence}
        productUrl="https://example.com"
      />
    )

    fireEvent.pointerDown(screen.getByRole('button', { name: /^Copy All Prompts$/i }), {
      button: 0,
      ctrlKey: false,
    })
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Copy All Prompts$/i }))
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled()
    })
    const copied = writeText.mock.calls[0]?.[0] as string
    expect(copied).toMatch(/1\. /)
    expect(copied).toMatch(/2\. /)
    expect(copied).toContain('Priority issue 1')
    expect(copied).toContain('Priority issue 2')
  })
})
