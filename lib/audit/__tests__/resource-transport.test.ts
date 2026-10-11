import { describe, expect, it } from 'vitest'
import { parseMetadataFromHtml, trimMetadataForStorage } from '../metadata'
import { runSecurityBasicsChecks } from '../checks/security'
import { recordCheckObservations } from '../checks/observations'
import { assertionForTarget } from '../checks/verification'
import { checkReceiptSchema } from '../checks/receipt'
import { runAllChecks } from '../checks'
import { pageMetadataSchema } from '../progressive/snapshots'
import { evaluatorHandlers } from '../progressive/evaluators'
import { readArtifact, serializeArtifact } from '../progressive/contracts'
import { checkArtifactSchema } from '../progressive/results'
import type { TaskContext } from '../progressive/registry'

const url = 'https://example.com/page'
function observation(html: string) {
  const metadata = parseMetadataFromHtml(html, url)
  const assertions = recordCheckObservations('security', { url, metadata, desktop: null, mobile: null })
  return { metadata, assertion: assertions.find(item => item.key === 'resource-transport')!, assertions }
}
function receipt(html: string) {
  const { assertions } = observation(html)
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'security',
    pageUrl: url, passed: assertions.every(item => item.passed), applicable: true, assertions })
}

describe('shared resource transport evidence', () => {
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
      <img src="http://localhost/image"><img src="http://127.0.0.1/image"><img src="http://[::1]/image">`)
    expect(metadata.h1s).toContain('Fallback heading')
    expect(metadata.resourceTransport!.insecure).toEqual([])
    expect(assertion.passed).toBe(true)
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
    const assertions = recordCheckObservations('security', { url, metadata, desktop: null, mobile: null })
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
      execution: { source: 'original-html' }, assertions: [{ key: 'https', passed: true }, { key: 'resource-transport', complete: false }] })
  })
})
