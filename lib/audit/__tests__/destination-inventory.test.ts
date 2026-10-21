import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { collectEligibleDestinations } from '../url-identity'
import { planReviewTargets } from '../review-depth'
import { openCheckDestinations } from '../open-check'
import { capturedPageLinks, checkPublicLinks, publicLinkObservations, publicLinkUrls, resolvedPageLinks } from '../checks/public-links'
import { parseMetadataFromHtml } from '../metadata'
import { checkReceiptSchema } from '../checks/receipt'
import { scopedAssertionForTarget } from '../checks/verification'

let origin = '', repaired = false
const requests: string[] = []
const server = createServer((request, response) => {
  requests.push(request.url!)
  response.setHeader('content-type', 'text/html')
  response.statusCode = repaired || request.url === '/pricing' ? 200 : 404
  response.end('<html><title>Plans</title></html>')
})
const paths = ['/pricing', '/fr/pricing', '/pricing?page=2', '/pricing?lang=fr', '/pricing/']
const links = paths.map(href => ({ href, text: 'See pricing' }))

beforeAll(async () => {
  vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
})
afterAll(async () => {
  vi.unstubAllEnvs(); server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
})

describe('physical link observation and representative review inventory', () => {
  it('does not rewrite credential-bearing links into unauthenticated public requests', async () => {
    const source = origin + '/source', target = new URL(origin + '/credential-protected')
    target.username = 'fixture-user'; target.password = 'fixture-password'
    const inventory = parseMetadataFromHtml('<a href="' + target.href + '">Private page</a>', source)
    requests.length = 0
    const opened = await openCheckDestinations([target.href], { origin: source })
    expect(requests).toEqual([])
    expect(opened.results).toEqual([])
    expect(publicLinkUrls(source, inventory)).toEqual([])
  })

  it('resolves fragment references against the observed base before deciding whether they leave the document', async () => {
    const source = origin + '/source', destination = origin + '/missing-plan/'
    const inventory = parseMetadataFromHtml('<html><head><base href="' + destination + '"></head><body><a href="#details">Plan details</a></body></html>', source)
    expect(publicLinkUrls(source, inventory)).toEqual([destination])
    expect(planReviewTargets({ pastedUrl: source, depth: 2, pastedLinks: resolvedPageLinks(source, inventory) }).reviewUrls)
      .toEqual([source, destination])
    requests.length = 0; repaired = false
    const observed = await checkPublicLinks(source, inventory, Date.now() + 5000)
    expect(requests).toEqual(['/missing-plan/'])
    expect(observed).toMatchObject({ complete: true, flags: [{ checkId: 'broken-internal-links', pageUrl: source }] })
    expect(observed.assertions).toHaveLength(1)
    expect(observed.assertions[0]).toMatchObject({ passed: false, complete: true })
    expect(publicLinkUrls(source, { ...inventory, linkBaseUrl: source })).toEqual([])
    expect(publicLinkUrls(source, { ...inventory, linkBaseUrl: 'https://foreign.example/' })).toEqual([])
  })

  it('retains representative deeper review while admitting every distinct public GET variant', () => {
    const plan = planReviewTargets({ pastedUrl: origin + '/source', depth: 2, pastedLinks: links })
    expect(collectEligibleDestinations(origin, links)).toHaveLength(1)
    expect(plan.reviewUrls).toEqual([origin + '/source', origin + '/pricing'])
    expect(new Set(plan.openCheckUrls)).toEqual(new Set(paths.map(path => origin + path)))
    const inventory = parseMetadataFromHtml(links.map(link => `<a href="${link.href}">${link.text}</a>`).join(''), origin)
    expect(publicLinkUrls(origin, inventory)).toEqual(paths.map(path => origin + path))
  })

  it('uses the same physical inventory from bounded native anchors without whole-document metadata', () => {
    const html = links.map(link => `<a href="${link.href}">${link.text}</a>`).join('')
    const inventory = capturedPageLinks({ renderedSearchSnapshot: { documentBaseUrl: origin, sections: {
      links: { html, complete: true, observed: links.length, limit: 2000, reason: null },
    } } }, null)!
    expect(publicLinkUrls(origin, inventory)).toEqual(paths.map(path => origin + path))
  })

  it('keeps representative breadth ahead of repeated variants within the existing request ceiling', () => {
    const crowded = [...Array.from({ length: 100 }, (_, index) => ({ href: '/pricing?page=' + index, text: 'See pricing' })),
      { href: '/features', text: 'Features' }]
    const plan = planReviewTargets({ pastedUrl: origin + '/source', depth: 2, pastedLinks: crowded })
    expect(plan.openCheckUrls.slice(0, 2)).toEqual([origin + '/pricing?page=0', origin + '/features'])
    const inventory = { links: crowded.map(link => ({ ...link, rel: null })) }
    expect(publicLinkUrls(origin, inventory).slice(0, 2)).toEqual(plan.openCheckUrls.slice(0, 2))
  })

  it('retains separate www and apex observations while reviewing one representative', () => {
    const source = 'https://example.com/'
    const links = [{ href: 'https://example.com/pricing', text: 'Pricing' }, { href: 'https://www.example.com/pricing', text: 'Plans' }]
    expect(collectEligibleDestinations(source, links)).toHaveLength(1)
    expect(publicLinkUrls(source, { links: links.map(link => ({ ...link, rel: null })) })).toEqual(links.map(link => link.href))
  })

  it('observes each physical variant, retains its original failure scope, independently verifies repair and recognizes recurrence', async () => {
    const source = origin + '/source'
    const plan = planReviewTargets({ pastedUrl: source, depth: 2, pastedLinks: links })
    requests.length = 0; repaired = false
    const opened = await openCheckDestinations(plan.openCheckUrls, { origin: source })
    expect(new Set(requests)).toEqual(new Set(paths))
    const broken = publicLinkObservations(source, plan.openCheckUrls, opened.results)
    expect(broken).toMatchObject({ complete: true, flags: [{ checkId: 'broken-internal-links' }] })
    expect(broken.assertions.filter(item => !item.passed)).toHaveLength(4)
    expect(broken.flags[0].evidenceTargets).toHaveLength(4)
    repaired = true
    try {
      const inventory = { links: links.map(link => ({ ...link, rel: null })) }
      const healthy = await checkPublicLinks(source, inventory, Date.now() + 5000)
      const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'seo', pageUrl: source,
        applicable: true, complete: healthy.complete, passed: !healthy.flags.length && healthy.complete, assertions: healthy.assertions,
        execution: { auditId: 'repair', taskId: 'native-http', checkVersion: 1, source: 'http', collectedAt: new Date().toISOString() } })
      expect(scopedAssertionForTarget({ receipt, checkId: broken.flags[0].checkId, flag: broken.flags[0] })?.assertion)
        .toMatchObject({ passed: true, complete: true })
      repaired = false
      const recurring = await checkPublicLinks(source, inventory, Date.now() + 5000)
      expect(new Set(recurring.flags[0].evidenceTargets?.map(target => target.context)))
        .toEqual(new Set(broken.flags[0].evidenceTargets?.map(target => target.context)))
    } finally { repaired = false }
  })

  it('counts the physical observation ceiling and never certifies variants excluded by that ceiling', async () => {
    const urls = paths.map(path => origin + path)
    const opened = await openCheckDestinations(urls, { origin, ceiling: 2 })
    expect(opened.truncated).toBe(true)
    expect(opened.results).toHaveLength(2)
    const observed = publicLinkObservations(origin, urls, opened.results)
    expect(observed.complete).toBe(false)
    expect(observed.assertions.slice(2).every(assertion => !assertion.passed && assertion.complete === false)).toBe(true)
  })

  it('deduplicates exact HTTP targets and fragments without merging trailing slashes, locales or queries', async () => {
    const input = [origin + '/pricing', origin + '/pricing#top', origin + '/pricing', ...paths.slice(1).map(path => origin + path)]
    const opened = await openCheckDestinations(input, { origin })
    expect(opened.results).toHaveLength(paths.length)
    expect(opened.results.map(result => result.url)).toEqual(paths.map(path => origin + path))
  })
})
