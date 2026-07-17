import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { MARKETING_LINKS, FOOTER_COLUMNS, ADMIN_NAV } from '@/lib/site/nav'

describe('marketing nav labels', () => {
  it('keeps marketing nav compact', () => {
    assert.deepEqual(
      MARKETING_LINKS.map((link) => [link.label, link.href]),
      [
        ['How it works', '/how-it-works'],
        ['Sample', '/#sample-review'],
        ['Pricing', '/pricing'],
      ]
    )
  })

  it('keeps changelog in the footer', () => {
    const changelog = FOOTER_COLUMNS.product.find((link) => link.label === 'Changelog')
    assert.ok(changelog)
    assert.equal(changelog.href, '/changelog')
  })

  it('keeps Sample nav pointed at the inline homepage explorer', () => {
    const sample = MARKETING_LINKS.find((link) => link.label === 'Sample')
    assert.ok(sample)
    assert.equal(sample.href, '/#sample-review')
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
