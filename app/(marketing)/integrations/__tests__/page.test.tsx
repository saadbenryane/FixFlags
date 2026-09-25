import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IntegrationsPage, { metadata } from '../page'
import { INTEGRATIONS_PAGE as C } from '@/lib/marketing/copy'
import { INDEXABLE_ROUTES, LLMS_SECTIONS } from '@/lib/marketing/seo-routes'
import { FOOTER_COLUMNS, MARKETING_LINKS } from '@/lib/site/nav'

vi.mock('@/components/audit/AuditInput', () => ({ AuditInput: () => <div data-testid="url-entry" /> }))
vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))

describe('integrations marketing page', () => {
  it('presents Shopify, Analytics, Search Console, and GitHub as connections', () => {
    render(<IntegrationsPage />)
    expect(screen.getByRole('heading', { level: 1, name: C.hero.title })).toBeInTheDocument()
    for (const item of C.items) {
      const card = document.getElementById(item.id)!
      expect(within(card).getByRole('heading', { name: item.title })).toBeInTheDocument()
      expect(within(card).getByRole('link', { name: new RegExp(item.action) })).toHaveAttribute('href', item.href)
      expect(within(card).getByText(item.limit)).toBeInTheDocument()
    }
    expect(screen.queryByText(/Coming later/i)).not.toBeInTheDocument()
    expect(screen.getByText(/does not scan the repository/i)).toBeInTheDocument()
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
