// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { Page } from 'playwright'
import { collectRenderedSearchSnapshot } from '../rendered-snapshot'
import { evaluateSearch } from '../registry'
import { assessSearchRecovery } from '../recovery'
import { document as recordedDocument, evidence, PAGE } from './fixtures'

const page = { evaluate: async (fn: () => unknown) => fn() } as unknown as Page
beforeEach(() => { document.documentElement.innerHTML = '<head></head><body></body>' })

describe('bounded rendered Search sections', () => {
  it('inspects useful Search evidence independently of a large hydration payload', async () => {
    document.head.innerHTML = '<title>Useful title</title><meta name="robots" content="index"><link rel="canonical" href="https://example.com/"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Useful title"}</script>'
    document.body.innerHTML = '<h1>Useful title</h1><a href="/about">About</a><script>' + 'x'.repeat(1_100_000) + '</script>'
    const snapshot = await collectRenderedSearchSnapshot(page)
    expect(JSON.stringify(snapshot).length).toBeLessThan(10_000)
    expect(Object.values(snapshot.sections).every(section => section.complete)).toBe(true)
    const collected = evidence('', { collectorVersion: 2, rendered: recordedDocument(null, { searchSnapshot: snapshot, complete: false, reason: 'document_truncated' }) })
    const observations = await evaluateSearch(collected)
    expect(observations.find(item => item.checkId === 'title-missing' && item.source === 'rendered-dom')).toMatchObject({ disposition: 'passed', observed: 'Useful title', checkVersion: 2 })
    expect(observations.find(item => item.checkId === 'search-discovery-links')).toMatchObject({ source: 'rendered-dom', disposition: 'observed' })
    expect(observations.find(item => item.checkId === 'search-structured-invalid' && item.source === 'rendered-dom')).toMatchObject({ disposition: 'passed' })
    expect(collected.rendered.complete).toBe(false)
    expect(collected.rendered.body).toBeNull()
  })

  it('keeps exhausted link coverage unknown without discarding complete metadata', async () => {
    document.head.innerHTML = '<title>Useful title</title>'
    document.body.innerHTML = '<h1>Title</h1>' + Array.from({ length: 2001 }, (_, i) => `<a href="/${i}">Page</a>`).join('')
    const snapshot = await collectRenderedSearchSnapshot(page)
    expect(snapshot.sections.links).toMatchObject({ complete: false, reason: 'section_limit', observed: 2001, limit: 2000 })
    expect(snapshot.sections.metadata.complete).toBe(true)
    const observations = await evaluateSearch(evidence('', { original: recordedDocument(null), collectorVersion: 2,
      rendered: recordedDocument(null, { searchSnapshot: snapshot, complete: false }) }))
    expect(observations.find(item => item.checkId === 'title-missing')).toMatchObject({ disposition: 'passed' })
    expect(observations.find(item => item.checkId === 'search-discovery-links')).toMatchObject({ disposition: 'unknown' })
  })

  it('does not certify historical recovery under the changed collector contract', async () => {
    document.head.innerHTML = '<title>Repaired title</title>'
    const snapshot = await collectRenderedSearchSnapshot(page)
    const observations = await evaluateSearch(evidence('', { collectorVersion: 2, rendered: recordedDocument(null, { searchSnapshot: snapshot, complete: false }) }))
    const receipt = { kind: 'search-checks' as const, version: 1 as const, auditId: 'new', pageUrl: PAGE,
      collectedAt: new Date().toISOString(), complete: false, observations }
    const policy = { policy: 'search', version: 1, kind: 'flag', reason: 'title_empty', sources: ['rendered-dom'] }
    expect(assessSearchRecovery(receipt, 'title-missing', policy)).toMatchObject({ comparable: false, verdict: 'unknown' })
    expect(assessSearchRecovery(receipt, 'title-missing', { ...policy, version: 2 })).toMatchObject({ comparable: true, verdict: 'passed' })
  })
})
