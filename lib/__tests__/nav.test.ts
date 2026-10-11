import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MARKETING_LINKS, FOOTER_COLUMNS, ADMIN_NAV } from '@/lib/site/nav'
import { LEGAL_LINKS } from '@/lib/site/nav'
import { INDEXABLE_ROUTES } from '@/lib/marketing/seo-routes'

describe('marketing nav labels', () => {
  it('keeps marketing nav compact', () => {
    assert.deepEqual(
      MARKETING_LINKS.map((link) => [link.label, link.href]),
      [
        ['Product', '/#product'],
        ['Pricing', '/pricing'],
        ['Integrations', '/integrations'],
        ['Docs', '/docs'],
      ]
    )
  })

  it('keeps changelog in the footer', () => {
    const changelog = FOOTER_COLUMNS.product.find((link) => link.label === 'Changelog')
    assert.ok(changelog)
    assert.equal(changelog.href, '/changelog')
  })

  it('keeps integrations discoverable without standalone install entries', () => {
    const hrefs = [
      ...FOOTER_COLUMNS.product,
      ...FOOTER_COLUMNS.resources,
      ...FOOTER_COLUMNS.company,
    ].map((link) => link.href)
    assert.ok(hrefs.includes('/integrations'))
    assert.ok(!hrefs.includes('/install'))
    assert.ok(!FOOTER_COLUMNS.product.some(link => link.label === 'Shopify'))
    assert.ok(FOOTER_COLUMNS.resources.some(link => link.href === '/docs'))
  })

  it('leads the product footer with the Site product', () => {
    assert.equal(FOOTER_COLUMNS.product[0]?.href, '/#product')
  })

  it('keeps footer destinations distinct and points only to published pages or contact', () => {
    const links = [...FOOTER_COLUMNS.product, ...FOOTER_COLUMNS.resources, ...FOOTER_COLUMNS.company, ...LEGAL_LINKS]
    const hrefs = links.map(link => link.href)
    assert.equal(new Set(hrefs).size, hrefs.length)
    assert.ok(hrefs.includes('/blog'))
    const published = new Set(INDEXABLE_ROUTES.map(route => route.path))
    for (const href of hrefs) {
      if (href.startsWith('mailto:')) continue
      const [path] = href.split('#')
      assert.ok(published.has(path), href)
    }
    assert.match(readFileSync('components/marketing/homepage/HomepageHero.tsx', 'utf8'), /id="product"/)
  })
})

describe('ADMIN_NAV', () => {
  it('includes Feedback and Leads', () => {
    const labels = ADMIN_NAV.map((link) => link.label)
    assert.ok(labels.includes('Feedback'))
    assert.ok(labels.includes('Leads'))
    assert.equal(ADMIN_NAV.find((l) => l.label === 'Feedback')?.href, '/admin/feedback')
    assert.equal(ADMIN_NAV.find((l) => l.label === 'Leads')?.href, '/admin/leads')
  })
})
