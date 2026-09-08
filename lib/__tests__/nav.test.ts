import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { MARKETING_LINKS, FOOTER_COLUMNS, ADMIN_NAV } from '@/lib/site/nav'

describe('marketing nav labels', () => {
  it('keeps marketing nav compact', () => {
    assert.deepEqual(
      MARKETING_LINKS.map((link) => [link.label, link.href]),
      [
        ['Product', '/#product'],
        ['Pricing', '/pricing'],
        ['For Shopify', '/install'],
        ['Docs', '/docs'],
      ]
    )
  })

  it('keeps changelog in the footer', () => {
    const changelog = FOOTER_COLUMNS.product.find((link) => link.label === 'Changelog')
    assert.ok(changelog)
    assert.equal(changelog.href, '/changelog')
  })

  it('keeps the Site and Shopify product paths discoverable in the footer', () => {
    const hrefs = [
      ...FOOTER_COLUMNS.product,
      ...FOOTER_COLUMNS.resources,
      ...FOOTER_COLUMNS.company,
    ].map((link) => link.href)
    assert.ok(hrefs.includes('/how-it-works'))
    assert.ok(hrefs.includes('/install'))
    assert.ok(hrefs.includes('/install'))
  })

  it('leads the product footer with the Site product', () => {
    assert.equal(FOOTER_COLUMNS.product[0]?.href, '/how-it-works')
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
