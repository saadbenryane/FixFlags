import { describe, expect, it } from 'vitest'
import { GUIDE_REVIEWED_AT, GUIDES_PAGE, WEBSITE_GUIDES, getWebsiteGuide } from '@/lib/marketing/copy/guides'
import { PUBLIC_OFFER } from '@/lib/marketing/copy/public-offer'
import { guideMetadata, guideSchema } from '@/components/marketing/guides/guide-seo'
import { SITE_URL } from '@/lib/marketing/copy/brand'

const primaryHosts = ['developer.mozilla.org', 'docs.lovable.dev', 'help.uptimerobot.com', 'www.checklyhq.com']

describe('buyer guide content and evidence contracts', () => {
  it('covers six distinct decisions with substantive original outlines', () => {
    expect(WEBSITE_GUIDES).toHaveLength(6)
    expect(new Set(WEBSITE_GUIDES.map(guide => guide.slug)).size).toBe(6)
    expect(new Set(WEBSITE_GUIDES.map(guide => guide.decision)).size).toBe(6)
    for (const guide of WEBSITE_GUIDES) {
      const body = [...guide.sections.flatMap(section => section.paragraphs), ...guide.example.paragraphs].join(' ')
      expect(body.split(/\s+/).length).toBeGreaterThanOrEqual(450)
      expect(body.split(/\s+/).length).toBeLessThanOrEqual(750)
      expect(new Set(guide.sections.map(section => section.id)).size).toBe(guide.sections.length)
      expect(guide.sections).toHaveLength(4)
      expect(guide.related.every(slug => slug !== guide.slug && Boolean(getWebsiteGuide(slug)))).toBe(true)
    }
  })

  it('keeps controlled examples, current limitations, and unknowns explicit', () => {
    expect(GUIDE_REVIEWED_AT).toBe('2026-10-20')
    expect(GUIDES_PAGE.offer).toBe(PUBLIC_OFFER.free)
    expect(GUIDES_PAGE.offerLimits).toBe(PUBLIC_OFFER.availability)
    for (const guide of WEBSITE_GUIDES) {
      const copy = JSON.stringify(guide)
      expect(copy).not.toContain('\u2014')
      expect(copy).not.toMatch(/guaranteed|cheapest|only platform|saves? \d+%/i)
      expect(guide.example.paragraphs.join(' ')).toContain('controlled illustration')
      expect(copy).toContain('Couldn’t verify')
      expect(copy).toMatch(/independent verification/i)
      expect(copy).toMatch(/stop(?:s)? before payment/)
      expect(copy).toMatch(/MCP connections/)
      expect(copy).toMatch(/paid integrations/)
      expect(copy).toMatch(/signup|Signup/)
    }
  })

  it('links claims to real primary-source URLs and keeps comparisons fair', () => {
    for (const guide of WEBSITE_GUIDES) {
      expect(guide.sources.some(source => source.href === '/coverage')).toBe(true)
      for (const source of guide.sources) {
        expect(source.supports.length).toBeGreaterThan(40)
        if (source.href.startsWith('http')) {
          const url = new URL(source.href)
          expect(url.protocol).toBe('https:')
          expect(primaryHosts).toContain(url.hostname)
        }
      }
      for (const section of guide.sections) {
        for (const id of section.sourceIds ?? []) expect(guide.sources[id]).toBeDefined()
      }
    }
    const uptime = getWebsiteGuide('fixflags-vs-uptime-monitoring')!
    expect(uptime.sources.some(source => source.href.includes('api-monitoring'))).toBe(true)
    expect(JSON.stringify(uptime)).toContain('inaccurate to describe every uptime product')
    expect(getWebsiteGuide('fixflags-vs-scripted-browser-monitoring')!.sources.some(source => source.href.includes('checklyhq.com'))).toBe(true)
  })

  it('gives every guide canonical article metadata and breadcrumb schema', () => {
    for (const guide of WEBSITE_GUIDES) {
      const metadata = guideMetadata(guide)
      expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/guides/${guide.slug}`)
      expect(metadata.openGraph).toMatchObject({ type: 'article', publishedTime: GUIDE_REVIEWED_AT, modifiedTime: GUIDE_REVIEWED_AT })
      const graph = guideSchema(guide)['@graph']
      expect(graph).toEqual(expect.arrayContaining([
        expect.objectContaining({ '@type': 'Article', headline: guide.title, dateModified: GUIDE_REVIEWED_AT }),
        expect.objectContaining({ '@type': 'BreadcrumbList', itemListElement: expect.arrayContaining([expect.objectContaining({ position: 2, item: `${SITE_URL}/guides/${guide.slug}` })]) }),
      ]))
    }
  })
})
