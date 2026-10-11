import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import IntegrationsPage, { metadata } from '../page'
import { CARE_HOME, INTEGRATIONS_PAGE as C } from '@/lib/marketing/copy'
import { INDEXABLE_ROUTES, LLMS_SECTIONS } from '@/lib/marketing/seo-routes'
import { FOOTER_COLUMNS, MARKETING_LINKS } from '@/lib/site/nav'

vi.mock('@/components/audit/AuditInput', () => ({ AuditInput: () => <div data-testid="url-entry" /> }))
vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))

describe('integrations marketing page', () => {
  it('shows logos and specific additional checks for current and proposed connections', () => {
    render(<IntegrationsPage />)
    expect(screen.getByRole('heading', { level: 1, name: C.hero.title })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Connect today' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'More signals to bring in' })).not.toBeInTheDocument()
    expect(C.items).toHaveLength(10)
    expect(C.items.filter(item => item.status === 'available')).toHaveLength(3)
    for (const item of C.items) {
      const card = document.getElementById(item.id)!
      expect(within(card).getByRole('heading', { name: item.title })).toBeInTheDocument()
      expect(card.querySelector('img')).toHaveAttribute('src', item.logo)
      expect(within(card).getByText(item.summary)).toBeInTheDocument()
      expect(within(card).getByRole('heading', { name: item.status === 'available' ? C.currentListTitle : C.futureListTitle })).toBeInTheDocument()
      for (const check of item.checks) expect(within(card).getByText(check)).toBeInTheDocument()
      if (item.status === 'available') expect(within(card).getByRole('link', { name: item.action })).toHaveAttribute('href', item.href)
      else expect(within(card).queryByRole('link')).not.toBeInTheDocument()
    }
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
      expect(item.action).toBe('Read integration guide')
      expect(item.href).toMatch(/^\/docs\/integrations\//)
    }
  })
})
