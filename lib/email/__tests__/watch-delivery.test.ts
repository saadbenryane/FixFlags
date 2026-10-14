import { describe, expect, it } from 'vitest'
import { selectWatchEmailDelivery, watchEmailProviderBody, watchEmailSelection } from '../watch-delivery'

const auditId = 'audit-1'
const baseKey = 'fixflags-watch-audit-1-v1'
const critical = { id: 'critical' }, important = { id: 'important' }, recovered = { id: 'recovered' }
function fresh(regressions = [critical, important], recoveries = [recovered], text = 'All findings') {
  return { version: 1 as const, from: 'FixFlags <watch@example.test>', to: 'owner@example.test',
    subject: text, text, html: '<p>' + text + '</p>', tags: [{ name: 'audit_id', value: auditId }],
    selection: watchEmailSelection('site-1', regressions, recoveries) }
}
const select = (message: ReturnType<typeof fresh>, recorded: unknown = null, broadLegacyPermission = false) =>
  selectWatchEmailDelivery({ auditId, fresh: message, recorded, broadLegacyPermission })

describe('Watch delivery selections', () => {
  it('keeps the exact provider body and key when names, templates, and ordering change', () => {
    const first = select(fresh())
    const retry = select(fresh([important, critical], [recovered], 'New template'), first)
    expect(retry.deliveryKey).toBe(baseKey)
    expect(watchEmailProviderBody(retry)).toEqual(watchEmailProviderBody(first))
  })

  it('records a new permitted message without overwriting the uncertain earlier delivery', () => {
    const first = select(fresh())
    const criticalOnly = select(fresh([critical], [recovered], 'Critical and recovery'), first)
    expect(criticalOnly.deliveryKey).not.toBe(baseKey)
    expect(criticalOnly.selection?.regressions).toEqual(['id:critical'])
    expect(criticalOnly.previous).toEqual([first])
    const noRecovery = select(fresh([critical], [], 'Critical only'), criticalOnly)
    expect(noRecovery.deliveryKey).not.toBe(criticalOnly.deliveryKey)
    expect(noRecovery.previous).toHaveLength(2)
    expect(noRecovery.previous?.[0].deliveryKey).toBe(criticalOnly.deliveryKey)
    expect(watchEmailProviderBody(noRecovery.previous![0])).toEqual(watchEmailProviderBody(criticalOnly))
    expect(noRecovery.previous?.[1]).toEqual(first)
    expect(watchEmailProviderBody(noRecovery).text).toBe('Critical only')
    expect(select(fresh([critical], [], 'New name'), noRecovery)).toEqual(noRecovery)
  })

  it('reuses an earlier immutable delivery when its selection is permitted again', () => {
    const first = select(fresh())
    const narrow = select(fresh([critical], [], 'Critical only'), first)
    const restored = select(fresh([important, critical], [recovered], 'Changed template'), narrow)
    expect(restored.deliveryKey).toBe(baseKey)
    expect(watchEmailProviderBody(restored)).toEqual(watchEmailProviderBody(first))
    expect(restored.previous).toHaveLength(1)
  })

  it('keeps broad legacy retries compatible without inventing recorded finding identities', () => {
    const { selection, ...legacy } = fresh()
    void selection
    const retry = select(fresh([critical], [], 'Changed template'), legacy, true)
    expect(retry.selection).toBeUndefined()
    expect(retry.deliveryKey).toBe(baseKey)
    expect(watchEmailProviderBody(retry)).toEqual(watchEmailProviderBody(legacy))
  })

  it('replaces an unscoped legacy message under restrictive permissions unless its exact body matches', () => {
    const { selection, ...legacy } = fresh()
    void selection
    expect(select(fresh(), legacy).deliveryKey).toBe(baseKey)
    const restricted = select(fresh([critical], [], 'Critical only'), legacy)
    expect(restricted.deliveryKey).not.toBe(baseKey)
    expect(restricted.previous).toEqual([legacy])
    expect(restricted.text).toBe('Critical only')
  })

  it.each([{ to: 'other@example.test' }, { tags: [{ name: 'audit_id', value: 'other' }] }])(
    'rejects recorded recipient or Audit mismatches', changed => {
      expect(() => select(fresh(), { ...select(fresh()), ...changed })).toThrow('no longer matches')
    })

  it('never includes delivery history or selection metadata in the provider request', () => {
    const revised = select(fresh([critical], [], 'Critical only'), select(fresh()))
    expect(Object.keys(watchEmailProviderBody(revised)).sort()).toEqual(['from', 'html', 'subject', 'tags', 'text', 'to'])
  })
})
