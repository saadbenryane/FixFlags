import { afterAll, describe, expect, it } from 'vitest'
import { parseMetadataFromHtml, trimMetadataForStorage } from '../metadata'
import { runSecurityBasicsChecks, securityObservations } from '../checks/security'
import { assertionForTarget, scopedAssertionForTarget } from '../checks/verification'
import { checkReceiptSchema } from '../checks/receipt'
import { runAllChecks } from '../checks'
import { pageMetadataSchema } from '../progressive/snapshots'
import { evaluatorHandlers } from '../progressive/evaluators'
import { readArtifact, serializeArtifact } from '../progressive/contracts'
import { checkArtifactSchema } from '../progressive/results'
import type { TaskContext } from '../progressive/registry'
import { closeParserWorker } from '../progressive/cpu'
import { collectResourceTransportEvidence } from '../resource-transport-collection'

afterAll(() => closeParserWorker())

const url = 'https://example.com/page'
function observation(html: string) {
  const metadata = parseMetadataFromHtml(html, url)
  const assertions = securityObservations(url, metadata)
  return { metadata, assertion: assertions.find(item => item.key === 'resource-transport')!, assertions }
}
function receipt(html: string) {
  const { assertions } = observation(html)
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'security',
    pageUrl: url, passed: assertions.every(item => item.passed), applicable: true, assertions,
    execution: { auditId: 'resource-audit', taskId: 'resource-check', checkVersion: 1, source: 'http', collectedAt: new Date().toISOString() } })
}

describe('shared resource transport evidence', () => {
  it('assesses the collected resource declarations independently of unrelated metadata limits', async () => {
    const body = '<html><head>' + '<script type="application/ld+json">{}</script>'.repeat(51) +
      '</head><body><img src="http://cdn.example/image.png?token=PRIVATE_TOKEN"></body></html>'
    expect(pageMetadataSchema.safeParse(parseMetadataFromHtml(body, url)).success).toBe(false)
    const document = { url, finalUrl: url, status: 200, headers: { 'content-type': 'text/html' }, body, complete: true,
      reason: null, collectedAt: new Date().toISOString(), redirects: [] }
    const context = { audit: { id: 'audit', executionSpec: { version: 1, targetUrl: url,
      environment: 'production', scope: 'SITE', checks: { 'security-mixed-content': 1 }, outcomes: [], verificationTarget: null } },
      task: { id: 'independent-resource' }, input: { pageUrl: url, position: 0, role: 'primary', primary: true, module: 'security' },
      deadline: Date.now() + 10_000, dependencies: new Map([['http', { workKind: 'http', workState: 'COMPLETED',
        workResult: serializeArtifact('http', { document, metadata: null }) }]]) } as unknown as TaskContext
    const artifact = await evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate(context)
    const result = checkArtifactSchema.parse(readArtifact(artifact, 'check').data)
    expect(result.flags).toMatchObject([{ checkId: 'security-mixed-content' }])
    expect(result.receipt.assertions.find(assertion => assertion.key === 'resource-transport')).toMatchObject({ passed: false, complete: true })
    expect(JSON.stringify(result)).not.toContain('PRIVATE_TOKEN')
  })
  it('keeps unavailable, mismatched and restricted documents outside resource repair evidence', async () => {
    const document = { url, finalUrl: url, status: 200, headers: { 'content-type': 'text/html' },
      body: '<img src="https://cdn.example/image.png">', complete: true, reason: null, collectedAt: new Date().toISOString(), redirects: [] }
    for (const gap of [{ complete: false }, { status: 503 }, { reason: 'public_access_challenge' },
      { url: 'https://another.example/page' }, { headers: { 'content-type': 'text/plain' } }]) {
      const resources = await collectResourceTransportEvidence(url, null, { ...document, ...gap }, Date.now() + 5000)
      expect(resources).toBeUndefined()
      const checked = await runAllChecks(url, null, null, null, [], undefined, null, null, undefined, true, ['security'], {
        publicDocument: { ...document, ...gap }, resourceTransport: resources,
      })
      expect(checked.executions[0].assertions?.find(assertion => assertion.key === 'resource-transport')).toMatchObject({ complete: false, passed: false })
    }
  })
  it('finds scripts, stylesheets, images, frames and media without fetching or claiming delivery', () => {
    const { metadata, assertion } = observation(`<script src="http://cdn.example/script.js"></script>
      <link rel="stylesheet" href="http://cdn.example/style.css"><img src="http://cdn.example/image.png">
      <iframe src="http://cdn.example/frame"></iframe><video src="http://cdn.example/video" poster="http://cdn.example/poster"></video>
      <audio><source src="http://cdn.example/audio"></audio><object data="http://cdn.example/object"></object>`)
    expect(metadata.resourceTransport).toMatchObject({ complete: true, inspected: 8 })
    expect(metadata.resourceTransport!.insecure).toHaveLength(8)
    expect(assertion).toMatchObject({ passed: false, complete: true })
    const flags = runSecurityBasicsChecks(url, metadata)
    expect(flags).toHaveLength(1)
    expect(flags[0].problem).toContain('declares 8 HTTP resources')
    expect(flags[0].evidence).toContain('actual browser delivery are outside')
    expect(pageMetadataSchema.parse(metadata).resourceTransport).toEqual(metadata.resourceTransport)
    expect(trimMetadataForStorage(metadata).resourceTransport).toEqual(metadata.resourceTransport)
  })

  it('resolves base and protocol-relative URLs while leaving ordinary navigation outside mixed content', () => {
    const { metadata } = observation(`<base href="http://cdn.example/assets/">
      <script src="app.js"></script><img src="//images.example/a.png">
      <a href="http://external.example">External</a><form action="http://example.com/submit"></form>
      <link rel="canonical" href="http://example.com/page"><link rel="preconnect" href="http://cdn.example">`)
    expect(metadata.resourceTransport!.insecure.map(item => item.url)).toEqual([
      'http://cdn.example/assets/app.js', 'http://images.example/a.png',
    ])
    expect(observation('<img src="//images.example/a.png">').assertion.passed).toBe(true)
  })

  it('covers responsive candidates without splitting a data URL into false HTTP sources', () => {
    const { metadata } = observation(`<picture><source srcset="http://cdn.example/wide.png 800w, https://cdn.example/narrow.png 400w">
      <img src="https://cdn.example/default.png" srcset="data:image/svg+xml,http://not-a-resource.example 1x, http://cdn.example/retina.png 2x"></picture>`)
    expect(metadata.resourceTransport!.insecure.map(item => item.url)).toEqual([
      'http://cdn.example/wide.png', 'http://cdn.example/retina.png',
    ])
  })

  it('keeps fallback metadata but excludes inert declarations and trustworthy loopback resources', () => {
    const { metadata, assertion } = observation(`<noscript><h1>Fallback heading</h1><img src="http://fallback.example/a.png"></noscript>
      <template><script src="http://template.example/app.js"></script></template>
      <script type="application/ld+json" src="http://metadata.example/data"></script>
      <img src="http://localhost/image"><img src="http://dev.localhost./image">
      <img src="http://127.0.0.1/image"><img src="http://127.1/image"><img src="http://[::1]/image">`)
    expect(metadata.h1s).toContain('Fallback heading')
    expect(metadata.resourceTransport!.insecure).toEqual([])
    expect(assertion.passed).toBe(true)
  })

  it('flags ordinary HTTP hostnames that resemble loopback addresses', () => {
    const { metadata, assertion } = observation(`<script src="http://127.cdn.example/app.js?token=SECRET"></script>
      <img src="http://127.0.0.1.cdn.example/image">`)
    expect(metadata.resourceTransport!.insecure.map(item => item.url)).toEqual([
      'http://127.cdn.example/app.js', 'http://127.0.0.1.cdn.example/image',
    ])
    expect(assertion).toMatchObject({ passed: false, complete: true })
    const [flag] = runSecurityBasicsChecks(url, metadata)
    expect(flag.evidence).toContain('http://127.cdn.example/app.js')
    expect(flag.evidence).not.toContain('SECRET')
  })

  it('recognizes executable HTML script declarations and ignores script data blocks', () => {
    const { metadata } = observation(`<script type=" application/x-javascript " src="http://cdn.example/legacy.js"></script>
      <script type="text/javascript1.5" src="http://cdn.example/versioned.js"></script>
      <script language="JScript" src="http://cdn.example/language.js"></script>
      <script type="" language="vbscript" src="http://cdn.example/empty-type.js"></script>
      <script type="MODULE" src="http://cdn.example/module.js"></script>
      <script type="text/javascript; charset=utf-8" src="http://cdn.example/parameters.js"></script>
      <script language="vbscript" src="http://cdn.example/unsupported.js"></script>`)
    expect(metadata.resourceTransport!.insecure.map(item => new URL(item.url).pathname)).toEqual([
      '/legacy.js', '/versioned.js', '/language.js', '/empty-type.js', '/module.js',
    ])
  })

  it('recollects historical inventories and requires current evidence for a new mixed-content finding', async () => {
    const body = '<script type="application/x-javascript" src="http://cdn.example/legacy.js"></script>'
    const legacy = { version: 1 as const, complete: true, inspected: 0, insecure: [] }
    const historical = { ...parseMetadataFromHtml(body, url), resourceTransport: legacy }
    expect(pageMetadataSchema.parse(historical).resourceTransport).toEqual(legacy)
    expect(securityObservations(url, historical)[1]).toMatchObject({ passed: false, complete: false })
    const resources = await collectResourceTransportEvidence(url, historical, { url, finalUrl: url, status: 200,
      headers: { 'content-type': 'text/html' }, body, complete: true, reason: null, collectedAt: new Date().toISOString(),
      redirects: [] }, Date.now() + 10_000)
    const [flag] = runSecurityBasicsChecks(url, historical, resources)
    expect(flag).toMatchObject({ checkId: 'security-mixed-content' })
    const repaired = receipt('<script type="application/x-javascript" src="https://cdn.example/legacy.js"></script>')
    const oldReceipt = { ...repaired, assertions: repaired.assertions.map(assertion => ({ ...assertion, context: undefined })) }
    expect(scopedAssertionForTarget({ receipt: oldReceipt, checkId: flag.checkId, flag })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: oldReceipt, checkId: flag.checkId, flag: {} })?.assertion).toMatchObject({ passed: true })
    expect(scopedAssertionForTarget({ receipt: repaired, checkId: flag.checkId, flag })?.assertion).toMatchObject({ passed: true })
  })

  it('preserves earlier proof while requiring corrected evidence to verify a current finding', async () => {
    const body = '<script src="http://127.cdn.example/app.js"></script>'
    const legacy = { version: 2 as const, complete: true, inspected: 1, insecure: [] }
    const historical = { ...parseMetadataFromHtml(body, url), resourceTransport: legacy }
    expect(pageMetadataSchema.parse(historical).resourceTransport).toEqual(legacy)
    expect(securityObservations(url, historical)[1]).toMatchObject({ passed: false, complete: false })
    const resources = await collectResourceTransportEvidence(url, historical, { url, finalUrl: url, status: 200,
      headers: { 'content-type': 'text/html' }, body, complete: true, reason: null, collectedAt: new Date().toISOString(),
      redirects: [] }, Date.now() + 10_000)
    const [flag] = runSecurityBasicsChecks(url, historical, resources)
    const repaired = receipt('<script src="https://127.cdn.example/app.js"></script>')
    const oldReceipt = { ...repaired, assertions: repaired.assertions.map(assertion => assertion.key === 'resource-transport'
      ? { ...assertion, context: 'resource-transport:v2' } : assertion) }
    expect(scopedAssertionForTarget({ receipt: oldReceipt, checkId: flag.checkId, flag })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: oldReceipt, checkId: flag.checkId, flag: { ...flag, evidenceTargets: undefined } })?.assertion)
      .toMatchObject({ passed: true })
    expect(scopedAssertionForTarget({ receipt: repaired, checkId: flag.checkId, flag })?.assertion).toMatchObject({ passed: true })
  })

  it('redacts credentials, queries and fragments and deduplicates resource evidence', () => {
    const { metadata } = observation(`<script src="http://user:password@cdn.example/app.js?token=secret#fragment"></script>
      <script src="http://cdn.example/app.js?token=another"></script>`)
    expect(metadata.resourceTransport!.insecure).toEqual([{ kind: 'script', url: 'http://cdn.example/app.js' }])
    expect(JSON.stringify(runSecurityBasicsChecks(url, metadata))).not.toMatch(/password|secret|token|fragment/)
  })

  it('retains observed failures and refuses successful proof after a collection limit or malformed URL', async () => {
    const { metadata, assertion } = observation('<img src="http://cdn.example/a.png">'.repeat(2001))
    expect(metadata.resourceTransport).toMatchObject({ inspected: 2000, complete: false })
    expect(runSecurityBasicsChecks(url, metadata)).toHaveLength(1)
    expect(assertion).toMatchObject({ passed: false, complete: false })
    expect(assertionForTarget(receipt('<img src="http://cdn.example/a.png">'.repeat(2001)), 'security-mixed-content')).toBeUndefined()
    expect(observation('<script src="http://[invalid"></script>').assertion).toMatchObject({ passed: false, complete: false })
    const result = await runAllChecks(url, metadata, null, null, [], undefined, undefined, undefined, undefined, true, ['security'])
    expect(result.executions[0]).toMatchObject({ passed: false, complete: false })
  })

  it('does not substitute historical image-only evidence for full resource repair proof', () => {
    const metadata = parseMetadataFromHtml('<img src="https://cdn.example/image">', url)
    delete metadata.resourceTransport
    const assertions = securityObservations(url, metadata)
    expect(assertions[1]).toMatchObject({ passed: false, complete: false })
    const historical = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'security',
      pageUrl: url, passed: true, applicable: true, assertions: [{ key: 'image-transport', name: 'Images',
        expected: 'No HTTP images', observed: '0 HTTP images', passed: true }] })
    expect(assertionForTarget(historical, 'security-mixed-content')).toBeUndefined()
    expect(assertionForTarget(receipt('<script src="https://cdn.example/app.js"></script>'), 'security-mixed-content')).toMatchObject({ passed: true, complete: true })
  })

  it('propagates an incomplete collector through the actual progressive evaluator receipt', async () => {
    const metadata = parseMetadataFromHtml('<script src="http://[invalid"></script>', url)
    const document = { url, finalUrl: url, status: 200, headers: { 'content-type': 'text/html' },
      body: '<script src="http://[invalid"></script>', complete: true, reason: null,
      collectedAt: new Date().toISOString(), redirects: [] }
    const context = { audit: { id: 'audit', executionSpec: { version: 1, targetUrl: url,
      environment: 'production', scope: 'SITE', checks: { 'security-mixed-content': 1 }, outcomes: [], verificationTarget: null } },
      task: { id: 'check' }, input: { pageUrl: url, position: 0, role: 'primary', primary: true, module: 'security' },
      deadline: Date.now() + 10_000, dependencies: new Map([['http', { workKind: 'http', workState: 'COMPLETED',
        workResult: serializeArtifact('http', { document, metadata }) }]]) } as unknown as TaskContext
    const artifact = await evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate(context)
    const result = checkArtifactSchema.parse(readArtifact(artifact, 'check').data)
    expect(result.flags).toEqual([])
    expect(result.receipt).toMatchObject({ complete: false, passed: false,
      execution: { source: 'http' }, assertions: [{ key: 'https', passed: true }, { key: 'resource-transport', complete: false }, { key: 'tls-certificate', passed: true, complete: true }] })
  })
})
