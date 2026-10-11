import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MetaPreviewClient } from '@/components/marketing/tools/MetaPreviewClient'
import { PlaceholderDetectorClient } from '@/components/marketing/tools/PlaceholderDetectorClient'
import { TOOLS } from '@/lib/marketing/copy/brand'

vi.mock('@/components/audit/AuditInput', () => ({
  AuditInput: ({ initialUrl = '', autoStart = false }: { initialUrl?: string; autoStart?: boolean }) => <input aria-label="Analysis URL" readOnly value={initialUrl} data-autostart={String(autoStart)} />,
}))
afterEach(() => vi.unstubAllGlobals())

describe('free tool to website analysis', () => {
  it('carries the checked URL from preview results without starting another scan', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: 'https://example.com/page', title: 'Example' }) })
    vi.stubGlobal('fetch', fetch)
    render(<MetaPreviewClient />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Website URL' }), { target: { value: 'example.com/page' } })
    fireEvent.click(screen.getByRole('button', { name: TOOLS.metaPreview.ctaCheck }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Analysis URL' })).toHaveValue('https://example.com/page'))
    expect(screen.getByRole('textbox', { name: 'Analysis URL' })).toHaveAttribute('data-autostart', 'false')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Install FixFlags on Shopify/)).not.toBeInTheDocument()
  })

  it('limits a clean placeholder result to its scope and retains the submitted URL', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ matches: [] }) })
    vi.stubGlobal('fetch', fetch)
    render(<PlaceholderDetectorClient />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Website URL' }), { target: { value: 'https://example.com/page' } })
    fireEvent.click(screen.getByRole('button', { name: TOOLS.placeholderDetector.ctaScan }))
    expect(await screen.findByText(TOOLS.placeholderDetector.noIssuesSubhead)).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Analysis URL' })).toHaveValue('https://example.com/page')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
