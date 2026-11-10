import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GuidesPage, { metadata } from '../page'
import GuidePage, { generateMetadata, generateStaticParams } from '../[slug]/page'
import { GUIDE_REVIEWED_AT, GUIDES_PAGE, WEBSITE_GUIDES } from '@/lib/marketing/copy/guides'
import { WEBSITE_GUIDE_SLUGS } from '@/lib/analytics/guide-entry'
import receipt from '@/lib/growth/evidence/destination-study-serving-base-2026-11-09.json'
import { DESTINATION_STUDY_EDITION_SHA256, destinationStudyDiscoveryVerified, inspectDestinationStudyPublication } from '@/lib/growth/destination-study-publication'
import { destinationStudyEdition } from '@/lib/marketing/copy/destination-study'

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') } }))

describe('website buyer guides', () => {
  it('makes every guide reachable from the server-rendered index', () => {
    render(<GuidesPage />)
    expect(screen.getByRole('heading', { level: 1, name: GUIDES_PAGE.title })).toBeInTheDocument()
    for (const guide of WEBSITE_GUIDES) {
      expect(screen.getByRole('link', { name: guide.title })).toHaveAttribute('href', `/guides/${guide.slug}`)
    }
    expect(metadata.alternates?.canonical).toContain('/guides')
    expect(generateStaticParams()).toEqual(WEBSITE_GUIDES.map(guide => ({ slug: guide.slug })))
    expect(WEBSITE_GUIDES.map(guide => guide.slug).sort()).toEqual([...WEBSITE_GUIDE_SLUGS].sort())
  })

  it('renders complete readable evidence with source links and next steps', async () => {
    for (const guide of WEBSITE_GUIDES) {
      const props = { params: Promise.resolve({ slug: guide.slug }) }
      const view = render(await GuidePage(props))
      expect(screen.getByRole('heading', { level: 1, name: guide.title })).toBeInTheDocument()
      expect(screen.getByText(guide.decision)).toBeInTheDocument()
      const nav = within(screen.getByRole('navigation', { name: GUIDES_PAGE.contents }))
      for (const section of guide.sections) {
        expect(nav.getByRole('link', { name: section.title })).toHaveAttribute('href', `#${section.id}`)
        expect(document.getElementById(section.id)).toHaveTextContent(section.paragraphs[0])
      }
      expect(screen.getByText(GUIDES_PAGE.exampleLabel)).toBeInTheDocument()
      expect(screen.getByText(GUIDE_REVIEWED_AT)).toHaveAttribute('dateTime', GUIDE_REVIEWED_AT)
      for (const source of guide.sources) {
        expect(screen.getAllByRole('link', { name: source.title }).every(link => link.getAttribute('href') === source.href)).toBe(true)
        expect(screen.getByText(source.supports)).toBeInTheDocument()
      }
      expect(screen.getByRole('link', { name: GUIDES_PAGE.start })).toHaveAttribute('href', '/new')
      expect(screen.getByRole('link', { name: GUIDES_PAGE.pricing })).toHaveAttribute('href', '/pricing')
      expect((await generateMetadata(props)).alternates?.canonical).toContain(`/guides/${guide.slug}`)
      const schema = JSON.parse(view.container.querySelector('script[type="application/ld+json"]')!.textContent!)
      expect(schema['@graph'][0]['@type']).toBe('Article')
      view.unmount()
    }
  })

  it('does not render or index unknown guide slugs', async () => {
    const props = { params: Promise.resolve({ slug: 'not-a-guide' }) }
    await expect(GuidePage(props)).rejects.toThrow('NOT_FOUND')
    await expect(generateMetadata(props)).rejects.toThrow('NOT_FOUND')
  })

  it('shows all recorded responses in the local guide without exporting internal provenance', async () => {
    const props = { params: Promise.resolve({ slug: 'website-online-but-not-working' }) }
    const view = render(await GuidePage(props))
    expect(screen.getByRole('link', { name: 'What HTTP 200 missed' })).toHaveAttribute('href', '#http-200-booking-study')
    const table = screen.getByRole('table', { name: /11 controlled responses/ })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map(row => Number(within(row).getAllByRole('cell')[0].textContent)))
      .toEqual(receipt.observations.map(row => row.httpStatus))
    expect(rows.every(row => within(row).getByRole('rowheader').textContent &&
      within(row).getAllByRole('cell')[1].textContent)).toBe(true)
    expect(within(rows[8]).getByRole('rowheader')).toHaveTextContent('Response exceeds the body limit')
    expect(within(rows[8]).getByText('Reachable')).toBeInTheDocument()
    expect(within(rows[9]).getByRole('rowheader')).toHaveTextContent('Working article about HTTP 404')
    expect(within(rows[9]).getByText('Marked missing')).toBeInTheDocument()
    expect(screen.getByText(/marked a working article about HTTP 404 as missing/)).toBeInTheDocument()
    expect(screen.getByText(/The study used synthetic responses/)).toBeInTheDocument()
    expect(view.container.innerHTML).not.toContain(receipt.source.fixtureSha256)
    expect(view.container.innerHTML).not.toContain('lib/audit/open-check.ts')
    expect(view.container.innerHTML).not.toContain('Dataset')
  })

  it('verifies the rendered study edition, including streamed delivery and changed verdicts', async () => {
    const guide = 'website-online-but-not-working'
    const url = `https://fixflags.com/guides/${guide}`
    const view = render(await GuidePage({ params: Promise.resolve({ slug: guide }) }))
    const markup = view.container.innerHTML
    const analyze = '<main><form><input name="url"><button type="submit">Analyze</button></form></main>'
    const robotsFile = 'User-agent: *\nAllow: /\nSitemap: https://fixflags.com/sitemap.xml'
    const entry = `<url><loc>${url}</loc><lastmod>${destinationStudyEdition.contentModifiedAt}T00:00:00.000Z</lastmod></url>`
    const sitemap = `<urlset>${entry}</urlset>`
    const llms = `# FixFlags\n\n- [Study guide](${url})`
    const inspect = (body: string, canonical = url, form = analyze, robots?: string,
      listings: { robots?: string; sitemap?: string | null; llms?: string | null } = {}) => inspectDestinationStudyPublication({
      fetch: vi.fn(async (requested, options) => {
        expect(options?.redirect).toBe('manual')
        if (requested === 'https://fixflags.com/robots.txt') {
          return new Response(listings.robots ?? robotsFile, { headers: { 'content-type': 'text/plain' } })
        }
        if (requested === 'https://fixflags.com/llms.txt') {
          return new Response(listings.llms ?? llms, {
            status: listings.llms === null ? 503 : 200, headers: { 'content-type': 'text/plain' },
          })
        }
        if (requested === 'https://fixflags.com/sitemap.xml') {
          return new Response(listings.sitemap ?? sitemap, {
            status: listings.sitemap === null ? 503 : 200, headers: { 'content-type': 'application/xml' },
          })
        }
        if (requested === 'https://fixflags.com/new') {
          return new Response(form, { headers: { 'content-type': 'text/html' } })
        }
        expect(requested).toBe(url)
        return new Response(`<head><link rel="canonical" href="${canonical}"></head><body>${body}</body>`,
          { headers: { 'content-type': 'text/html', ...(robots && { 'x-robots-tag': robots }) } })
      }),
    })
    const streamed = `<template id="B:0"></template><div hidden id="S:0">${markup}</div>`
    expect(await inspect(streamed + '<script>$RC("B:0","S:0")</script>')).toMatchObject({
      version: 4, state: 'edition-match', editionSha256: DESTINATION_STUDY_EDITION_SHA256,
      discovery: { analyzeLink: 'streamed', analyzeForm: 'direct', indexDirective: 'no-noindex-observed',
        crawlerRules: 'allowed', sitemapEntry: 'edition-date', articleMetadata: 'edition-matched', llmsEntry: 'canonical-guide' },
    })
    expect(await inspect(streamed)).toMatchObject({ state: 'edition-mismatch' })
    expect(await inspect(`<div aria-hidden="true">${markup}</div>`)).toMatchObject({ state: 'edition-mismatch' })
    expect(await inspect(markup.replace('Marked missing', 'Reachable'))).toMatchObject({ state: 'edition-mismatch' })
    expect(await inspect(markup.replace('href="https://www.rfc-editor.org/', 'href="https://outside.example/'))).toMatchObject({ state: 'edition-mismatch' })
    expect(await inspect(markup, 'https://fixflags.com/guides')).toMatchObject({ state: 'canonical-mismatch' })
    expect(await inspect('<article>No study</article>')).toMatchObject({ state: 'absent' })
    expect(await inspect(markup.replace('href="/new"', 'href="/pricing"'))).toMatchObject({
      state: 'edition-match', discovery: { analyzeLink: 'missing', analyzeForm: 'unavailable' },
    })
    expect(await inspect(markup, url, '<main><form><input name="url" disabled><button type="submit" disabled>Analyze</button></form></main>')).toMatchObject({
      state: 'edition-match', discovery: { analyzeLink: 'direct', analyzeForm: 'direct' },
    })
    expect(await inspect(markup, url, '<main><form><input name="other"><button type="submit">Analyze</button></form></main>')).toMatchObject({
      state: 'edition-match', discovery: { analyzeLink: 'direct', analyzeForm: 'missing' },
    })
    expect(await inspect(markup, url, analyze, 'noindex,follow')).toMatchObject({
      state: 'edition-match', discovery: { indexDirective: 'noindex' },
    })
    const matches = (report: Awaited<ReturnType<typeof inspect>>) =>
      report.state === 'edition-match' && destinationStudyDiscoveryVerified(report.discovery)
    expect(matches(await inspect(markup))).toBe(true)
    for (const [listings, expected] of [
      [{ robots: robotsFile + '\nUser-agent: bingbot\nDisallow: /guides' }, { crawlerRules: 'blocked' }],
      [{ robots: 'User-agent: *\nAllow: /' }, { crawlerRules: 'sitemap-unadvertised' }],
      [{ sitemap: sitemap.replace(destinationStudyEdition.contentModifiedAt, GUIDE_REVIEWED_AT) }, { sitemapEntry: 'date-mismatch' }],
      [{ sitemap: `<urlset>${entry}${entry}</urlset>` }, { sitemapEntry: 'missing-or-ambiguous' }],
      [{ sitemap: null }, { sitemapEntry: 'unavailable' }],
      [{ llms: llms.replace(url, url + '?preview=1') }, { llmsEntry: 'missing-or-ambiguous' }],
      [{ llms: llms + `\n- [Duplicate](${url})` }, { llmsEntry: 'missing-or-ambiguous' }],
      [{ llms: null }, { llmsEntry: 'unavailable' }],
    ] as const) {
      const report = await inspect(markup, url, analyze, undefined, listings)
      expect(report).toMatchObject({ state: 'edition-match', discovery: expected })
      expect(matches(report)).toBe(false)
    }
    const staleArticle = await inspect(markup.replace(
      `"dateModified":"${destinationStudyEdition.contentModifiedAt}"`, `"dateModified":"${GUIDE_REVIEWED_AT}"`))
    expect(staleArticle).toMatchObject({ state: 'edition-match', discovery: { articleMetadata: 'missing-or-mismatch' } })
    expect(matches(staleArticle)).toBe(false)
    const addedCitation = await inspect(markup.replace('"citation":[', '"citation":["https://outside.example/",'))
    expect(addedCitation).toMatchObject({ state: 'edition-match', discovery: { articleMetadata: 'missing-or-mismatch' } })
    expect(matches(addedCitation)).toBe(false)
  })

  it('withholds the unpublished study and its citations in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      const props = { params: Promise.resolve({ slug: 'website-online-but-not-working' }) }
      const view = render(await GuidePage(props))
      expect(screen.queryByText('What HTTP 200 missed')).not.toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(view.container.innerHTML).not.toContain('rfc-editor.org')
      expect((await generateMetadata(props)).openGraph).toMatchObject({ modifiedTime: GUIDE_REVIEWED_AT })
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
