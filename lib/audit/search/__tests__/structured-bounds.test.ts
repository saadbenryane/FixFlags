import { describe, expect, it } from 'vitest'
import { searchReceiptSchema } from '../contracts'
import { evaluateSearch, searchFindings } from '../registry'
import { assessSearchRecovery } from '../recovery'
import { document, evidence, markup, PAGE } from './fixtures'
import { buildEditorHandoffPrompt } from '@/lib/audit/editor-handoff'
import { observationsForFlag } from '@/lib/audit/flag-observations'

async function inspect(body: string, rendered = body) {
  const input = evidence(body, { rendered: document(rendered) })
  const observations = await evaluateSearch(input, undefined, ['structured-data'])
  return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'inspection', pageUrl: PAGE,
    collectedAt: input.collectedAt, complete: !observations.some(item => item.disposition === 'unknown'), observations })
}

describe('bounded structured-data evidence', () => {
  it('carries every recorded malformed block into the repair task instead of only the syntax summary', async () => {
    const receipt = await inspect('<html><head><title>Example website</title>' +
      '<script type="application/ld+json">{"@type":</script>' +
      '<script type="application/ld+json">{"name": BROKEN_SECOND_BLOCK}</script></head><body>Example website</body></html>')
    const flag = searchFindings(receipt.observations).find(item => item.checkId === 'search-structured-invalid')!
    const supporting = observationsForFlag(flag, { auditId: 'private-audit', taskId: 'private-task', checkVersion: 1 })
    const prompt = buildEditorHandoffPrompt({ ...flag, id: 'syntax-flag', supportingObservations: supporting })
    expect(prompt).toContain('{"@type":')
    expect(prompt).toContain('{"name": BROKEN_SECOND_BLOCK}')
    expect(prompt).toContain('original-html')
    expect(prompt).toContain('rendered-dom')
    for (const item of receipt.observations.filter(item => item.checkId === flag.checkId && item.reason === 'invalid_json')) {
      for (const reference of item.evidence) expect(prompt).toContain(reference.locator)
    }
  })

  it('keeps every invalid breadcrumb property and verifies repair beyond the first property record', async () => {
    const body = (phase: 'broken' | 'partial' | 'repaired') => markup({ '@context': 'https://schema.org',
      '@id': '#breadcrumbs', '@type': 'BreadcrumbList', itemListElement: Array.from({ length: 45 }, (_, index) => ({
        '@type': 'ListItem', name: 'Example website', item: PAGE + index,
        position: phase === 'broken' || phase === 'partial' && index === 44 ? 0 : index + 1,
      })) })
    const broken = await inspect(body('broken'))
    const flag = searchFindings(broken.observations).find(item => item.checkId === 'search-structured-feature')!
    expect(flag).toBeDefined()
    const targets = flag.attentionPolicy!.markupTargets!
    const supporting = observationsForFlag(flag, { auditId: 'private-audit', taskId: 'private-task', checkVersion: 1,
      collectedAt: broken.collectedAt })
    const prompt = buildEditorHandoffPrompt({ ...flag, id: 'breadcrumb-flag', supportingObservations: supporting })
    expect(prompt).toContain(PAGE + '#breadcrumbs')
    expect(prompt).toContain('Invalid: itemListElement[44].position')
    expect(prompt).not.toMatch(/private-audit|private-task|markupTargets|attentionPolicy/)
    for (const source of ['original-html', 'rendered-dom']) {
      const properties = targets.filter(target => target.source === source).flatMap(target => target.properties)
      expect(properties).toHaveLength(45)
      expect(properties).toContain('itemListElement[44].position')
    }
    expect(broken.complete).toBe(true)
    expect(assessSearchRecovery(await inspect(body('partial')), flag.checkId, flag.attentionPolicy))
      .toMatchObject({ comparable: true, verdict: 'failed' })
    expect(assessSearchRecovery(await inspect(body('repaired')), flag.checkId, flag.attentionPolicy))
      .toMatchObject({ comparable: true, verdict: 'passed' })
  })

  it('preserves more than 200 original source targets through findings and independent recovery', async () => {
    const body = (broken: boolean) => markup({ '@context': 'https://schema.org', '@graph': Array.from({ length: 120 }, (_, index) => ({
      '@id': '#product-' + index, '@type': 'Product', name: 'Example website', url: broken ? 'invalid URL' : PAGE,
    })) })
    const broken = await inspect(body(true))
    const flag = searchFindings(broken.observations).find(item => item.checkId === 'search-structured-feature')!
    expect(flag.attentionPolicy?.markupTargets).toHaveLength(240)
    expect(flag.attentionPolicy?.pageScopes?.[0].markupTargets).toHaveLength(240)
    const supporting = observationsForFlag(flag, { auditId: 'private-audit', taskId: 'private-task', checkVersion: 1 })
    const prompt = buildEditorHandoffPrompt({ ...flag, id: 'products-flag', supportingObservations: supporting })
    for (let index = 0; index < 120; index++) expect(prompt).toContain(PAGE + '#product-' + index)
    expect(prompt).not.toMatch(/private-audit|private-task|markupTargets|attentionPolicy/)
    expect(prompt).toContain('original-html')
    expect(prompt).toContain('rendered-dom')
    expect(assessSearchRecovery(await inspect(body(false)), flag.checkId, flag.attentionPolicy))
      .toMatchObject({ comparable: true, verdict: 'passed' })
    const recurrence = await inspect(body(true))
    expect(assessSearchRecovery(recurrence, flag.checkId, flag.attentionPolicy).verdict).toBe('failed')
  })

  it('retains late rendered failures when healthy and advisory observations exceed the receipt budget', async () => {
    const body = (broken: boolean) => markup({ '@context': 'https://schema.org', '@graph': Array.from({ length: 200 }, (_, index) => ({
      '@id': '#entity-' + index, '@type': ['Organization', 'WebSite'], name: 'Example website',
      url: broken && index === 199 ? 'invalid URL' : PAGE,
    })) })
    const receipt = await inspect(body(false), body(true))
    expect(receipt.complete).toBe(false)
    expect(receipt.observations).toHaveLength(500)
    expect(receipt.observations.at(-1)).toMatchObject({ checkId: 'search-observation-coverage', reason: 'observation_limit', disposition: 'unknown' })
    const flag = searchFindings(receipt.observations).find(item => item.checkId === 'search-structured-feature')!
    expect(flag.attentionPolicy?.markupTargets).toEqual(expect.arrayContaining([
      expect.objectContaining({ entityId: PAGE + '#entity-199', entityType: 'Organization', source: 'rendered-dom', properties: ['url'] }),
      expect.objectContaining({ entityId: PAGE + '#entity-199', entityType: 'WebSite', source: 'rendered-dom', properties: ['url'] }),
    ]))
    expect(assessSearchRecovery(receipt, flag.checkId, flag.attentionPolicy))
      .toMatchObject({ comparable: false, verdict: 'unknown' })
  })

  it('saves a valid Flag and refuses recovery certification when failures alone exceed the budget', async () => {
    const body = markup({ '@context': 'https://schema.org', '@graph': Array.from({ length: 150 }, (_, index) => ({
      '@id': '#entity-' + index, '@type': ['Organization', 'WebSite'], name: 'Example website', url: 'invalid URL',
    })) })
    const receipt = await inspect(body)
    const flag = searchFindings(receipt.observations).find(item => item.checkId === 'search-structured-feature')!
    expect(receipt.observations.filter(item => item.disposition === 'failed')).toHaveLength(499)
    expect(flag.attentionPolicy?.markupTargets).toHaveLength(499)
    expect(assessSearchRecovery(receipt, flag.checkId, flag.attentionPolicy))
      .toMatchObject({ comparable: false, verdict: 'unknown' })
  })
})
