import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FAQ, FAQ_PAGE, FINAL_CTA, HERO, HOW_IT_WORKS_PAGE, LANDING_PAGE, PLANS, PRICING, PRICING_FAQ, SEO } from '@/lib/marketing/copy'
import { HELP_ARTICLES, HELP_CATEGORIES } from '@/lib/help/catalog'
import { FOOTER_COLUMNS, MARKETING_LINKS } from '@/lib/site/nav'

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value)
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out)
  }
  return out
}

function docsMarkdown(): string {
  const root = join(process.cwd(), 'content/docs')
  return readdirSync(root)
    .filter((name) => name.endsWith('.md'))
    .map((name) => readFileSync(join(root, name), 'utf8'))
    .join('\n')
}

const PARKED_PRODUCT = [
  /website roast/i,
  /\bcli\b/i,
  /\bmcp\b/i,
  /paste a (live )?url/i,
  /paste-url/i,
  /fix prompt/i,
  /message, experience, and reach/i,
  /product reviews? per month/i,
  /agent chat/i,
]

const STRANGER_SURFACES = collectStrings({
  HERO,
  FINAL_CTA,
  howItWorks: LANDING_PAGE.howItWorks,
  proof: LANDING_PAGE.proof,
  layers: LANDING_PAGE.layers,
  hero: HOW_IT_WORKS_PAGE.hero,
  loop: HOW_IT_WORKS_PAGE.loop,
  finalCta: HOW_IT_WORKS_PAGE.finalCta,
  FAQ,
  FAQ_PAGE,
  PLANS,
  PRICING,
  PRICING_FAQ,
  seo: {
    home: SEO.home,
    protect: SEO.protect,
    install: SEO.install,
    pricing: SEO.pricing,
    faq: SEO.faq,
    help: SEO.help,
    docs: SEO.docs,
    howItWorks: SEO.howItWorks,
  },
  MARKETING_LINKS,
  FOOTER_COLUMNS,
  HELP_CATEGORIES,
  HELP_ARTICLES,
})

describe('stranger-facing website care', () => {
  it('starts with a website URL, not Shopify-only', () => {
    expect(HERO.primaryHref).toBe('/#audit')
    expect(PRICING.headline).toMatch(/waitlist/i)
    expect(PLANS.find((plan) => plan.plan === 'FREE')?.cta).toBe('Check my website')
    expect(MARKETING_LINKS.some((link) => link.href === '/pricing')).toBe(true)
  })

  it('does not advertise parked Product Review, Roast, CLI, or MCP', () => {
    const blob = `${STRANGER_SURFACES.join('\n')}\n${docsMarkdown()}`
    for (const pattern of PARKED_PRODUCT) {
      expect(blob, String(pattern)).not.toMatch(pattern)
    }
    const footerHrefs = [...FOOTER_COLUMNS.product, ...FOOTER_COLUMNS.resources, ...FOOTER_COLUMNS.company].map(
      (link) => link.href
    )
    expect(footerHrefs).not.toContain('/roast')
    expect(footerHrefs).not.toContain('/samples')
    expect(footerHrefs).not.toContain('/examples')
  })

  it('FAQ explains a live website check and keeps Shopify as a connection', () => {
    const faq = FAQ.map((entry) => `${entry.question} ${entry.answer}`).join('\n')
    expect(faq).toMatch(/live website/i)
    expect(faq).toMatch(/before payment/i)
    expect(faq).toMatch(/shopify is a connection/i)
    expect(faq).not.toMatch(/\$29|\$99/)
    expect(HELP_ARTICLES.some((article) => /install/i.test(article.title))).toBe(true)
    expect(docsMarkdown()).toMatch(/Shopify is a \[connection\]/i)
    expect(docsMarkdown()).toMatch(/Find → Understand → Fix → Verify/)
  })

  it('pricing is free plus waitlist, with no billed SKU prices', () => {
    expect(PRICING.headline).toMatch(/waitlist/i)
    expect(PLANS.find((plan) => plan.plan === 'FREE')?.cta).toBe('Check my website')
    expect(PLANS.find((plan) => plan.plan === 'BUILDER')?.price).toBe('Waitlist')
    expect(JSON.stringify({ PLANS, PRICING, PRICING_FAQ })).not.toMatch(/\$29|\$99/)
  })
})

describe('pricing comparison table source', () => {
  it('does not pull billed Product Review prices into the Shopify comparison', () => {
    const source = readFileSync(join(process.cwd(), 'components/pricing/PricingComparisonTable.tsx'), 'utf8')
    expect(source).not.toMatch(/PLAN_DEFINITIONS/)
    expect(source).not.toMatch(/product reviews/)
    expect(source).toMatch(/PLANS/)
    expect(source).toMatch(/PRICING_COMPARISON/)
  })
})
