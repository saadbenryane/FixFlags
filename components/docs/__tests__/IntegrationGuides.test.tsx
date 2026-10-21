import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DocsNavigation } from '@/components/docs/DocsNavigation'
import { DocsMobileNavigation } from '@/components/docs/DocsMobileNavigation'
import { ShopifyConnectionRecovery } from '@/components/docs/ShopifyConnectionRecovery'
import { HelpRelatedDocs } from '@/components/help/HelpRelatedDocs'
import { HELP_ARTICLES } from '@/lib/help/catalog'
import IntegrationGuide, { generateMetadata, generateStaticParams } from '@/app/(docs)/docs/integrations/[integration]/page'
import IntegrationsDocsPage from '@/app/(docs)/docs/integrations/page'
import DocsHomePage from '@/app/(docs)/docs/page'
import { getDocsPage } from '@/lib/docs/catalog'

vi.mock('@/lib/docs/content', async () => {
  const { readFileSync } = await import('node:fs')
  const { applyGeneratedBlocks } = await import('@/lib/docs/generated-blocks')
  return { readDocsMarkdown: async (page: { source: string }) => applyGeneratedBlocks(readFileSync(`${process.cwd()}/content/docs/${page.source}`, 'utf8'), page.source) }
})
vi.mock('next/navigation', () => ({
  usePathname: () => '/docs/integrations/shopify',
  notFound: () => { throw new Error('NOT_FOUND') },
}))
vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))

describe('integration guides', () => {
  it('offers direct paths on the documentation home while preserving its article anchors', async () => {
    render(await DocsHomePage())
    for (const key of ['getting-started', 'site-care', 'fix-with-ai', 'integrations'] as const) {
      const page = getDocsPage(key)
      const title = screen.getByRole('heading', { level: 2, name: page.title })
      expect(title.closest('a')).toHaveAttribute('href', page.path)
      expect(title.closest('a')).toHaveTextContent(page.description)
    }
    expect(screen.getByRole('heading', { name: 'Quick start' })).toHaveAttribute('id', 'quick-start')
    expect(screen.getByRole('heading', { name: 'The product loop' })).toHaveAttribute('id', 'the-product-loop')
  })
  it('includes integration guides in desktop navigation and marks the current page', () => {
    render(<DocsNavigation />)
    expect(screen.getByRole('link', { name: 'Shopify' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Google Analytics' })).toHaveAttribute('href', '/docs/integrations/google-analytics')
    expect(screen.getByRole('link', { name: 'Google Search Console' })).toHaveAttribute('href', '/docs/integrations/google-search-console')
  })

  it('includes the same guides in mobile navigation', () => {
    render(<DocsMobileNavigation entries={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open documentation navigation' }))
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'Shopify' })).toHaveAttribute('href', '/docs/integrations/shopify')
  })

  it('renders the overview and all guide content through the docs shell', async () => {
    const overview = render(await IntegrationsDocsPage())
    expect(screen.getByRole('heading', { level: 1, name: 'Integration guides' })).toBeInTheDocument()
    overview.unmount()
    expect(generateStaticParams()).toHaveLength(4)
    for (const integration of ['github', 'shopify', 'google-analytics', 'google-search-console']) {
      const props = { params: Promise.resolve({ integration }), searchParams: Promise.resolve({}) }
      const guide = render(await IntegrationGuide(props))
      expect(screen.getByRole('link', { name: 'Integration guides' })).toHaveAttribute('href', '/docs/integrations')
      expect(screen.getByRole('heading', { name: 'Connect', level: 2 })).toHaveAttribute('id', 'connect')
      expect(screen.getByRole('link', { name: 'Open Websites' })).toHaveAttribute('href', '/dashboard')
      expect((await generateMetadata(props)).alternates?.canonical).toContain(`/docs/integrations/${integration}`)
      guide.unmount()
    }
    await expect(IntegrationGuide({ params: Promise.resolve({ integration: 'unknown' }), searchParams: Promise.resolve({}) })).rejects.toThrow('NOT_FOUND')
  })

  it('renders recognized recovery codes without echoing arbitrary query input', () => {
    const view = render(<ShopifyConnectionRecovery error="state" />)
    expect(screen.getByRole('alert')).toHaveTextContent('invalid or expired')
    expect(screen.getByRole('link', { name: 'Open your Sites' })).toHaveAttribute('href', '/dashboard')
    for (const error of ['<script>secret</script>', 'constructor', 'toString', undefined]) {
      view.rerender(<ShopifyConnectionRecovery error={error} />)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    }
  })

  it.each(['not_configured', 'missing', 'hmac', 'state', 'token', 'fixture_shop'])('renders bounded recovery for %s', (error) => {
    render(<ShopifyConnectionRecovery error={error} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Shopify connection did not finish')
    expect(screen.getByRole('alert')).toHaveTextContent('Other connections become available after testing and validation.')
  })

  it('links Shopify Help to the dedicated guide', () => {
    render(<HelpRelatedDocs article={HELP_ARTICLES.find(article => article.slug === 'connect-shopify')!} />)
    expect(screen.getByRole('link', { name: 'Shopify' })).toHaveAttribute('href', '/docs/integrations/shopify')
  })
})
