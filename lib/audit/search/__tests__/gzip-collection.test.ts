import { createServer, type Server } from 'node:http'
import { gzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { collectDocument, collectSiteResources, parseSitemap, SEARCH_DOCUMENT_LIMIT } from '../collect'
import { resourceArtifactSchema } from '../../progressive/snapshots'
import { evaluateSearch } from '../registry'
import { document, evidence, PAGE } from './fixtures'

const xml = '<urlset><url><loc>https://example.com/pricing</loc></url></urlset>'
let origin = ''
const server: Server = createServer((request, response) => {
  response.setHeader('content-type', 'application/gzip')
  if (request.url === '/transport.xml.gz') {
    response.setHeader('content-encoding', 'gzip'); response.end(gzipSync(xml)); return
  }
  if (request.url === '/double.xml.gz') {
    response.setHeader('content-encoding', 'gzip'); response.end(gzipSync(gzipSync(xml))); return
  }
  if (request.url === '/index.xml.gz') {
    response.end(gzipSync(`<sitemapindex><sitemap><loc>${origin}/pages.xml.gz</loc></sitemap></sitemapindex>`)); return
  }
  if (request.url === '/large.xml.gz') {
    response.end(gzipSync('<urlset>' + ' '.repeat(SEARCH_DOCUMENT_LIMIT) + '</urlset>')); return
  }
  if (request.url === '/corrupt.xml.gz') { response.end(gzipSync(xml).subarray(0, 15)); return }
  if (request.url === '/invalid.xml.gz') { response.end(gzipSync('<urlset><url>')); return }
  if (request.url === '/plain.xml') {
    response.setHeader('content-type', 'application/xml'); response.end(xml); return
  }
  response.end(gzipSync(xml))
})

beforeAll(async () => {
  vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
})
afterAll(async () => {
  vi.unstubAllEnvs()
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
})

describe('compressed sitemap collection through native HTTP', () => {
  it.each(['/pages.xml.gz', '/transport.xml.gz', '/double.xml.gz', '/plain.xml'])('inspects the XML document from %s without double decoding transport compression', async path => {
    const collected = await collectDocument(origin + path, Date.now() + 5000)
    expect(collected).toMatchObject({ status: 200, complete: true, body: xml })
    expect(parseSitemap(collected)).toMatchObject({ valid: true, urls: [PAGE + 'pricing'] })
  })

  it('follows a compressed index and preserves the compressed child URL in collected provenance', async () => {
    const resources = await collectSiteResources(origin, Date.now() + 5000,
      document(`User-agent: *\nSitemap: ${origin}/index.xml.gz`))
    expect(resourceArtifactSchema.parse(resources)).toMatchObject({ complete: true, sitemapUrls: [PAGE + 'pricing'],
      declaredSitemaps: [origin + '/index.xml.gz', origin + '/pages.xml.gz'] })
    expect(resources.sitemaps.map(item => item.url)).toEqual([origin + '/index.xml.gz', origin + '/pages.xml.gz'])
  })

  it.each(['/large.xml.gz', '/corrupt.xml.gz'])('keeps %s unavailable rather than diagnosing invalid XML', async path => {
    const collected = await collectDocument(origin + path, Date.now() + 5000)
    expect(collected.complete).toBe(false)
    expect(Buffer.byteLength(collected.body ?? '')).toBeLessThanOrEqual(SEARCH_DOCUMENT_LIMIT)
    expect(parseSitemap(collected).valid).toBe(false)
    const observations = await evaluateSearch(evidence('', { sitemaps: [collected], declaredSitemaps: [collected.url],
      sitemapsComplete: false }), null, ['discovery'])
    expect(observations.find(item => item.checkId === 'search-sitemap-invalid')).toMatchObject({ disposition: 'unknown' })
  })

  it('still flags fully collected malformed XML after successful decompression', async () => {
    const collected = await collectDocument(origin + '/invalid.xml.gz', Date.now() + 5000)
    expect(collected).toMatchObject({ status: 200, complete: true, body: '<urlset><url>' })
    const observations = await evaluateSearch(evidence('', { sitemaps: [collected], declaredSitemaps: [collected.url] }), null, ['discovery'])
    expect(observations.find(item => item.checkId === 'search-sitemap-invalid')).toMatchObject({ disposition: 'failed' })
  })
})
