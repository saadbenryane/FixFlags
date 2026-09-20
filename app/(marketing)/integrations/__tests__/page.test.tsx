import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IntegrationsPage, { metadata } from '../page'
import { INTEGRATIONS_PAGE as C } from '@/lib/marketing/copy'
import { INDEXABLE_ROUTES, LLMS_SECTIONS } from '@/lib/marketing/seo-routes'
import { FOOTER_COLUMNS, MARKETING_LINKS } from '@/lib/site/nav'

vi.mock('@/components/audit/AuditInput', () => ({ AuditInput: () => <div data-testid="url-entry" /> }))
vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))

describe('integrations marketing page', () => {
  it('presents Shopify as available and future connections as unavailable', () => {
    render(<IntegrationsPage />)
    expect(screen.getByRole('heading', { level: 1, name: C.hero.title })).toBeInTheDocument()
    const available = screen.getByText(C.available.label).closest('article')!
    expect(within(available).getByRole('heading', { name: C.available.title })).toBeInTheDocument()
    expect(within(available).getByRole('link', { name: /Connect Shopify/i })).toHaveAttribute('href', '/install')
    const future = screen.getByText(C.future.label).closest('article')!
    for (const item of C.future.items) expect(within(future).getByRole('heading', { name: item.title })).toBeInTheDocument()
    expect(within(future).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByTestId('url-entry')).toBeInTheDocument()
  })

  it('is indexable, canonical, discoverable, and replaces the Shopify-only nav link', () => {
    expect(metadata.alternates?.canonical).toMatch(/\/integrations$/)
    expect(metadata.robots).toMatchObject({ index: true, follow: true })
    expect(INDEXABLE_ROUTES.some(route => route.path === '/integrations' && route.seoKey === 'integrations')).toBe(true)
    expect(LLMS_SECTIONS.flatMap(section => section.links).some(link => link.path === '/integrations')).toBe(true)
    expect(MARKETING_LINKS).toContainEqual({ href: '/integrations', label: 'Integrations' })
    expect(MARKETING_LINKS.some(link => link.label === 'For Shopify')).toBe(false)
    expect(FOOTER_COLUMNS.product).toContainEqual({ href: '/install', label: 'Shopify' })
  })
})
