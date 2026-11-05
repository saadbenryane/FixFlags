import { describe, expect, it } from 'vitest'
import { evaluateSearch, searchFindings } from '../search/registry'
import { searchReceiptSchema } from '../search/contracts'
import { evidence, document, PAGE } from '../search/__tests__/fixtures'
import { observationsForFlag, mergeSupportingObservations, publicSupportingObservations, readSupportingObservations } from '../flag-observations'
import { recordedVerificationVerdict } from '../recovery-evidence'

const absentTitle = '<html><head></head><body><h1>Useful service</h1></body></html>'
const origin = { auditId: 'before', taskId: 'rendered-source', checkVersion: 1, collectedAt: '2026-10-20T12:00:00.000Z' }
async function titleFlag(rendered = true) {
  const input = evidence(absentTitle, rendered ? {} : { rendered: document(null) })
  return searchFindings(await evaluateSearch(input, null, ['presentation'])).find(flag => flag.checkId === 'title-missing')!
}
async function result(rendered: 'healthy' | 'missing' | 'unavailable') {
  const input = evidence(undefined, rendered === 'unavailable' ? { rendered: document(null) }
    : rendered === 'missing' ? { rendered: document(absentTitle) } : {})
  return searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: 'after', pageUrl: PAGE,
    collectedAt: input.collectedAt, complete: rendered !== 'unavailable', observations: await evaluateSearch(input, null, ['presentation']) })
}

describe('original Search policy custody in supporting observations', () => {
  it('freezes the original policy and excludes it from the public observation view', async () => {
    const flag = await titleFlag(), recorded = observationsForFlag(flag, origin)
    expect(recorded.items[0]).toMatchObject({ attentionPolicy: JSON.parse(JSON.stringify(flag.attentionPolicy)) })
    const saved = JSON.stringify(recorded)
    flag.attentionPolicy!.sources = ['original-html']
    expect(JSON.stringify(recorded)).toBe(saved)
    expect(publicSupportingObservations(recorded)[0]).not.toHaveProperty('attentionPolicy')
  })

  it('does not apply a later representative policy to retained earlier source evidence', async () => {
    const first = await titleFlag(), later = await titleFlag(false)
    const supportingObservations = mergeSupportingObservations([
      observationsForFlag(first, origin), observationsForFlag(later, { ...origin, taskId: 'original-html-source' }),
    ])
    // Incremental persistence retains both observations and the latest Flag
    // policy. That display representative cannot replace original comparison authority.
    const projected = { ...later, supportingObservations }
    const assess = async (rendered: 'healthy' | 'missing' | 'unavailable') => recordedVerificationVerdict({
      auditId: 'after', executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: PAGE,
        environment: 'production', checks: { 'title-missing': 1 }, outcomes: [], verificationTarget: null }, flag: projected,
      executions: [{ targetKey: 'module:search-presentation', status: 'COMPLETED', detail: await result(rendered) }],
    })
    expect(await assess('unavailable')).toBeNull()
    expect(await assess('missing')).toBe('failed')
    expect(await assess('healthy')).toBe('passed')
  })

  it('does not invent policy custody for historical observations', async () => {
    const flag = await titleFlag(), recorded = observationsForFlag(flag, origin)
    const historical = { ...recorded, items: recorded.items.map(item => {
      const old = { ...item }
      delete old.attentionPolicy
      return old
    }) }
    expect(readSupportingObservations(historical)).not.toBeNull()
    expect(recordedVerificationVerdict({ auditId: 'after', executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE',
      targetUrl: PAGE, environment: 'production', checks: { 'title-missing': 1 }, outcomes: [], verificationTarget: null },
      flag: { ...flag, supportingObservations: historical },
      executions: [{ targetKey: 'module:search-presentation', status: 'COMPLETED', detail: await result('healthy') }],
    })).toBeNull()
  })

  it.each([{ policy: {} }, { policy: { policy: 'unsupported' } }, { policy: [] }, { policy: false }])('withholds repair when the frozen policy cannot be interpreted: $policy', async ({ policy }) => {
    const flag = await titleFlag(), recorded = observationsForFlag(flag, origin)
    const supportingObservations = { ...recorded, items: recorded.items.map(item => ({ ...item, attentionPolicy: policy })) }
    expect(recordedVerificationVerdict({ auditId: 'after', executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE',
      targetUrl: PAGE, environment: 'production', checks: { 'title-missing': 1 }, outcomes: [], verificationTarget: null },
      flag: { ...flag, supportingObservations },
      executions: [{ targetKey: 'module:search-presentation', status: 'COMPLETED', detail: await result('healthy') }],
    })).toBeNull()
  })
})
