import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SamplesPage from '@/app/(marketing)/samples/page'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { LATEST_STATIC_SAMPLE_OBSERVATION_ID } from '@/lib/marketing/static-sample'

vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({
  MarketingPageViewTracker: () => null,
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/samples',
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
}))

describe('/samples', () => {
  it('shows an immutable fixture as one Site and evidence-backed Flag', async () => {
    render(await SamplesPage({ searchParams: Promise.resolve({ observation: 'curated-sample-v0' }) }))

    expect(screen.getByTestId('sample-site')).toHaveAttribute('data-observation', 'curated-sample-v0')
    expect(screen.getByRole('heading', { name: PUBLIC_SITE_COPY.samplePage.title })).toBeInTheDocument()
    expect(screen.getByText('Primary CTA is hidden below the fold on mobile')).toBeInTheDocument()
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/report workspace/i)).not.toBeInTheDocument()
    expect(decodeURIComponent(screen.getByRole('img', { name: PUBLIC_SITE_COPY.samplePage.imageAlt }).getAttribute('src')!)).toContain('/samples/observations/curated-sample-v0/mobile.webp')
    expect(screen.getByRole('button', { name: PUBLIC_SITE_COPY.samplePage.copy })).toBeInTheDocument()
    expect(screen.getByText(PUBLIC_SITE_COPY.samplePage.verificationBody)).toBeVisible()
    expect(screen.queryByRole('button', { name: /verify/i })).not.toBeInTheDocument()
  })

  it('defaults an absent observation to the current immutable sample', async () => {
    render(await SamplesPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByTestId('sample-site')).toHaveAttribute('data-observation', LATEST_STATIC_SAMPLE_OBSERVATION_ID)
  })

  it('returns not found for an explicit unknown observation', async () => {
    await expect(SamplesPage({
      searchParams: Promise.resolve({ observation: 'not-a-published-observation' }),
    })).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
