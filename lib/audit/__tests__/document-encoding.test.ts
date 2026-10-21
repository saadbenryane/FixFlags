import { createServer } from 'node:http'
import { gzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { safeFetchDocument, safeFetchHtml } from '../url'
import { collectDocument, parseSitemap } from '../search/collect'
import { parseMetadataFromHtml } from '../metadata'
import { collectionHandlers } from '../progressive/collectors'
import { httpArtifactSchema } from '../progressive/snapshots'
import { readArtifact } from '../progressive/contracts'
import type { TaskContext } from '../progressive/registry'
import { checkPublicLinks } from '../checks/public-links'
import { scopedAssertionForTarget } from '../checks/verification'
import { checkReceiptSchema } from '../checks/receipt'

const title = 'Café à Montréal, 10€'
const latinTitle = Buffer.from('Caf\xe9 \xe0 Montr\xe9al, 10\x80', 'latin1')
const html = (declaration = '', bytes = latinTitle) => Buffer.concat([
  Buffer.from(`<html><head>${declaration}<title>`), bytes,
  Buffer.from('</title></head><body><h1>Bienvenue</h1><a href="/caf\xe9">Contact</a></body></html>', 'latin1'),
])
const xml = '<?xml version="1.0" encoding="iso-8859-1"?><urlset><url><loc>https://example.com/café</loc></url></urlset>'
let origin = ''
let linkStatus = 404
const linkRequests: string[] = []
const server = createServer((request, response) => {
  response.setHeader('content-type', 'text/html')
  switch (request.url) {
    case '/caf%C3%A9': linkRequests.push(request.url); response.statusCode = linkStatus; response.end('<html><title>Contact</title></html>'); return
    case '/header': response.setHeader('content-type', 'Text/HTML; CHARSET="iso-8859-1"'); response.end(html()); return
    case '/meta': response.end(html('<meta charset="windows-1252">')); return
    case '/pragma': response.end(html('<meta content="text/html; charset=windows-1252" http-equiv="Content-Type">')); return
    case '/precedence': response.setHeader('content-type', 'text/html;charset=windows-1252'); response.end(html('<meta charset="utf-8">')); return
    case '/bom': response.setHeader('content-type', 'text/html;charset=windows-1252'); response.end(Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('<html><title>Café 日本</title></html>'),
    ])); return
    case '/utf16le': response.end(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<html><title>Café 日本</title></html>', 'utf16le')])); return
    case '/utf16be': response.end(Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from('<html><title>Café 日本</title></html>', 'utf16le').swap16()])); return
    case '/shift-jis': response.setHeader('content-type', 'text/html;charset=shift_jis'); response.end(html('', Buffer.from('93fa967b', 'hex'))); return
    case '/gzip': response.setHeader('content-type', 'text/html;charset=windows-1252'); response.setHeader('content-encoding', 'gzip'); response.end(gzipSync(html())); return
    case '/sitemap.xml.gz': response.setHeader('content-type', 'application/gzip'); response.end(gzipSync(Buffer.from(xml, 'latin1'))); return
    case '/sitemap.xml': response.setHeader('content-type', 'application/xml'); response.end(Buffer.from(xml, 'latin1')); return
    case '/utf16.xml': response.setHeader('content-type', 'application/xml'); response.end(Buffer.from('<?xml version="1.0" encoding="UTF-16"?><urlset><url><loc>https://example.com/café</loc></url></urlset>', 'utf16le')); return
    case '/unknown': response.setHeader('content-type', 'text/html;charset=unsupported-label'); response.end('<html><title>Café 日本</title></html>'); return
    default: response.end('<html><title>Café 日本</title></html>')
  }
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

describe('declared document encodings through native public HTTP', () => {
  it.each(['/header', '/meta', '/pragma', '/precedence', '/gzip'])('preserves original title and link text from %s', async path => {
    const collected = await safeFetchHtml(origin + path)
    const metadata = parseMetadataFromHtml(collected.html, collected.finalUrl)
    expect(metadata.title).toBe(title)
    expect(metadata.documentLinks).toContainEqual({ href: '/café', text: 'Contact' })
  })

  it.each(['/bom', '/utf16le', '/utf16be', '/unknown', '/default'])('decodes %s with BOM precedence and the existing UTF-8 fallback', async path => {
    const collected = await collectDocument(origin + path, Date.now() + 5000)
    expect(collected.complete).toBe(true)
    expect(parseMetadataFromHtml(collected.body!, collected.finalUrl).title).toBe('Café 日本')
  })

  it('decodes a declared multibyte legacy encoding', async () => {
    const collected = await safeFetchHtml(origin + '/shift-jis')
    expect(parseMetadataFromHtml(collected.html, collected.finalUrl).title).toBe('日本')
  })

  it.each(['/sitemap.xml', '/sitemap.xml.gz', '/utf16.xml'])('retains encoded sitemap locations and original provenance from %s', async path => {
    const collected = await collectDocument(origin + path, Date.now() + 5000)
    expect(collected).toMatchObject({ url: origin + path, finalUrl: origin + path, complete: true, status: 200 })
    expect(parseSitemap(collected)).toMatchObject({ valid: true, urls: ['https://example.com/caf%C3%A9'] })
  })

  it('retains the byte collection bound after decoding a legacy charset', async () => {
    const collected = await safeFetchDocument(origin + '/header', { maxBytes: 60 })
    expect(collected.complete).toBe(false)
    expect(collected.body.length).toBeLessThanOrEqual(60)
    expect(collected.body).not.toContain('\ufffd')
  })

  it('publishes the same decoded document and metadata from the actual HTTP task handler', async () => {
    const artifact = await collectionHandlers.find(handler => handler.kind === 'http')!.evaluate({
      input: { pageUrl: origin + '/header' }, deadline: Date.now() + 12_000,
    } as TaskContext)
    const stored = httpArtifactSchema.parse(readArtifact(artifact, 'http').data)
    expect(stored.document).toMatchObject({ complete: true, status: 200, url: origin + '/header' })
    expect(stored.metadata?.title).toBe(title)
    expect(stored.document.body).toContain(title)
  })

  it('flags the actual encoded link, independently verifies its repair and recognizes recurrence', async () => {
    const source = origin + '/header'
    const document = await safeFetchHtml(source)
    const inventory = parseMetadataFromHtml(document.html, document.finalUrl)
    linkRequests.length = 0
    linkStatus = 404
    const broken = await checkPublicLinks(source, inventory, Date.now() + 5000)
    expect(broken.flags).toHaveLength(1)
    expect(broken.flags[0].checkId).toBe('broken-internal-links')
    expect(broken.assertions[0]).toMatchObject({ passed: false, complete: true })
    linkStatus = 200
    try {
      const healthy = await checkPublicLinks(source, inventory, Date.now() + 5000)
      const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'seo', pageUrl: source,
        applicable: true, passed: true, complete: healthy.complete, assertions: healthy.assertions,
        execution: { auditId: 'independent-repair', taskId: 'native-http', checkVersion: 1,
          source: 'http', collectedAt: new Date().toISOString() } })
      expect(healthy.flags).toEqual([])
      expect(scopedAssertionForTarget({ receipt, checkId: broken.flags[0].checkId, flag: broken.flags[0] })?.assertion)
        .toMatchObject({ passed: true, complete: true })
      linkStatus = 404
      const recurring = await checkPublicLinks(source, inventory, Date.now() + 5000)
      expect(recurring.flags[0].evidenceTargets).toEqual(broken.flags[0].evidenceTargets)
      expect(recurring.assertions[0]).toMatchObject({ passed: false, complete: true })
      expect(linkRequests).toEqual(['/caf%C3%A9', '/caf%C3%A9', '/caf%C3%A9'])
    } finally { linkStatus = 404 }
  })
})
