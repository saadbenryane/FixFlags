import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { MARKETING_LINKS, FOOTER_COLUMNS, ADMIN_NAV } from '@/lib/site/nav'
import { LEGAL_LINKS } from '@/lib/site/nav'
import { BLOG_POSTS } from '@/lib/marketing/copy/blog'
import { INDEXABLE_ROUTES } from '@/lib/marketing/seo-routes'

describe('marketing nav labels', () => {
  it('keeps marketing nav compact', () => {
    assert.deepEqual(
      MARKETING_LINKS.map((link) => [link.label, link.href]),
      [
        ['Product', '/how-it-works'],
        ['For AI builders', '/ai-builders'],
        ['Pricing', '/pricing'],
        ['Docs', '/docs'],
        ['Changelog', '/changelog'],
      ]
    )
  })

  it('keeps changelog in the footer', () => {
    const changelog = FOOTER_COLUMNS.resources.find((link) => link.label === 'Changelog')
    assert.ok(changelog)
    assert.equal(changelog.href, '/changelog')
  })

  it('keeps the footer to the essentials without retired pages or install entries', () => {
    const hrefs = Object.values(FOOTER_COLUMNS).flat().map((link) => String(link.href))
    assert.ok(hrefs.length <= 16, `footer has ${hrefs.length} links`)
    for (const retired of ['/samples', '/use-cases', '/integrations', '/faq', '/roast', '/request-demo', '/install']) {
      assert.ok(!hrefs.includes(retired), retired)
    }
    assert.ok(!FOOTER_COLUMNS.product.some(link => link.label === 'Shopify'))
    assert.ok(FOOTER_COLUMNS.resources.some(link => link.href === '/docs'))
    assert.ok(FOOTER_COLUMNS.resources.some(link => link.href === '/help'))
  })

  it('leads the product footer with the Site product', () => {
    assert.equal(FOOTER_COLUMNS.product[0]?.href, '/how-it-works')
  })

  it('keeps footer destinations distinct and points only to published pages or contact', () => {
    const links = Object.values(FOOTER_COLUMNS).flat()
    const hrefs = links.map(link => String(link.href))
    assert.equal(new Set(hrefs).size, hrefs.length)
    assert.ok(hrefs.includes('/blog'))
    const published = new Set([...INDEXABLE_ROUTES.map(route => route.path), ...BLOG_POSTS.map(post => `/blog/${post.slug}`)])
    for (const href of [...hrefs, ...LEGAL_LINKS.map(link => link.href)]) {
      if (href.startsWith('mailto:')) continue
      const [path] = href.split('#')
      assert.ok(published.has(path), href)
    }
    for (const link of MARKETING_LINKS) assert.ok(published.has(link.href), link.href)
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
