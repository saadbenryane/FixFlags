import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IntegrationsPage, { metadata } from '../page'
import { CARE_HOME, INTEGRATIONS_PAGE as C } from '@/lib/marketing/copy-barrel'
import { INDEXABLE_ROUTES, LLMS_SECTIONS } from '@/lib/marketing/seo-routes'
import { FOOTER_COLUMNS, MARKETING_LINKS } from '@/lib/site/nav'

vi.mock('@/components/audit/AuditInput', () => ({ AuditInput: () => <div data-testid="url-entry" /> }))
vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))

describe('integrations marketing page', () => {
  it('shows detailed cards only for available connections and lists planned ones quietly', () => {
    render(<IntegrationsPage />)
    expect(screen.getByRole('heading', { level: 1, name: C.hero.title })).toBeInTheDocument()
    const available = C.items.filter(item => item.status === 'available')
    const planned = C.items.filter(item => item.status === 'planned')
    expect(available).toHaveLength(1)
    expect(planned).toHaveLength(9)
    expect(screen.getAllByRole('article')).toHaveLength(available.length)
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument()
    for (const item of available) {
      const card = document.getElementById(item.id)!
      expect(card.tagName).toBe('ARTICLE')
      expect(within(card).getByRole('heading', { name: item.title })).toBeInTheDocument()
      expect(card.querySelector('img')).toHaveAttribute('src', item.logo)
      expect(within(card).getByText(item.summary)).toBeInTheDocument()
      expect(within(card).getByRole('heading', { name: C.currentListTitle })).toBeInTheDocument()
      for (const check of item.checks) expect(within(card).getByText(check)).toBeInTheDocument()
      expect(within(card).getByRole('link', { name: item.action })).toHaveAttribute('href', item.href)
    }
    const plannedSection = screen.getByRole('region', { name: C.plannedTitle })
    const plannedItems = within(plannedSection).getAllByRole('listitem')
    expect(plannedItems.map(item => item.textContent)).toEqual(planned.map(item => item.title))
    for (const item of planned) {
      // Homepage links deep-link to /integrations#<id>, so every planned connection keeps its anchor.
      expect(document.getElementById(item.id)?.tagName).toBe('LI')
      expect(screen.queryByText(item.summary)).not.toBeInTheDocument()
    }
    expect(within(plannedSection).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByTestId('url-entry')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: CARE_HOME.close.title })).toBeInTheDocument()
    expect(screen.getByText(CARE_HOME.close.body)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: CARE_HOME.close.pricing })).toHaveAttribute('href', '/pricing')
  })

  it('is indexable, canonical, discoverable, and replaces the Shopify-only nav link', () => {
    expect(metadata.alternates?.canonical).toMatch(/\/integrations$/)
    expect(metadata.robots).toMatchObject({ index: true, follow: true })
    expect(INDEXABLE_ROUTES.some(route => route.path === '/integrations' && route.seoKey === 'integrations')).toBe(true)
    expect(LLMS_SECTIONS.flatMap(section => section.links).some(link => link.path === '/integrations')).toBe(true)
    expect(MARKETING_LINKS).toContainEqual({ href: '/integrations', label: 'Integrations' })
    expect(MARKETING_LINKS.some(link => link.label === 'For Shopify')).toBe(false)
    expect(FOOTER_COLUMNS.product).toContainEqual({ href: '/integrations', label: 'Integrations' })
    expect(FOOTER_COLUMNS.product.some(link => link.label === 'Shopify')).toBe(false)
    for (const item of C.items.filter(item => item.status === 'available')) {
      expect(item.action).toBe('Manage GitHub connection')
      expect(item.href).toBe('/settings/integrations')
    }
  })
})
