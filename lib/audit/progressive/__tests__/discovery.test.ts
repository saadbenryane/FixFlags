import { describe, expect, it } from 'vitest'
import { lifecycleHandlers } from '../lifecycle'
import { DISCOVERY_BATCH_SIZE, planDiscoveryObservations, discoveryObservations } from '../discovery'
import type { PageLinkInventory } from '../../checks/public-links'
import type { OpenCheckObservation } from '../../open-check'
import { scopedAssertionForTarget } from '../../checks/verification'
import { publicLinkContext } from '../../checks/destination-evidence'

const root = 'https://example.com/', peer = root + 'peer'
const inventory = (urls: string[], complete = true): PageLinkInventory => ({
  links: urls.map(href => ({ href, text: 'Useful details', rel: null })), linkBaseUrl: root, documentUrl: root, complete,
})
const response = (url: string, status = 200): OpenCheckObservation => ({ url, status,
  outcome: status === 404 ? 'not_found' : 'reachable', shouldFlagDead: status === 404 })
const execution = { auditId: 'fresh', taskId: 'discovery', collectedAt: '2026-11-03T04:00:00Z' }

describe('bounded public-link discovery', () => {
  it('attributes every selected fresh destination even when its source link is beyond the inventory prefix', () => {
    const added = Array.from({ length: 130 }, (_, index) => root + 'other/' + index), important = root + 'pricing'
    const plan = planDiscoveryObservations({ origin: root, ceiling: 2, urls: [important, ...added],
      sources: [{ url: root, navigation: inventory([...added, important]) }] })
    expect(plan.members.filter(member => member.kind === 'destination')).toContainEqual({ kind: 'destination', url: important, sources: [root] })
    const checked = discoveryObservations(plan.members, [response(important, 404), response(added[0])], execution)[0]
    expect(checked.flags[0].evidenceTargets).toMatchObject([{ context: publicLinkContext(root, important) }])
    expect(checked.complete).toBe(false)
  })
  it('retains known destination responsibility ahead of new links within both fetch and source inventory budgets', () => {
    const added = Array.from({ length: 130 }, (_, index) => root + 'aaa-new/' + index)
    const original = root + 'z-original?scope=original', variant = root + 'z-original?scope=changed'
    const plan = planDiscoveryObservations({ origin: root, ceiling: 2, urls: [...added, variant, original],
      sources: [{ url: root, navigation: inventory([...added, variant, original]) }],
      retainedContexts: new Set([publicLinkContext(root, original)]) })
    expect(plan.members.filter(member => member.kind === 'destination')).toEqual([
      { kind: 'destination', url: original, sources: [root] }, { kind: 'destination', url: added[0], sources: [root] },
    ])
    const observed = discoveryObservations(plan.members, [response(original, 404), response(added[0])], execution)[0]
    expect(observed.flags[0].evidenceTargets).toMatchObject([{ context: publicLinkContext(root, original) }])
    expect(observed.complete).toBe(false)
    expect(plan.truncated).toBe(true)
  })
  it('never admits a removed URL or transfers historical page responsibility to a different source', () => {
    const original = root + 'original', changed = root + 'original?changed=1', fresh = root + 'fresh'
    for (const source of [{ url: root, urls: [fresh, changed] }, { url: peer, urls: [fresh, original] }]) {
      const plan = planDiscoveryObservations({ origin: root, ceiling: 1, urls: source.urls,
        sources: [{ url: source.url, navigation: inventory(source.urls) }], retainedContexts: new Set([publicLinkContext(root, original)]) })
      expect(plan.members.filter(member => member.kind === 'destination').map(member => member.url)).toEqual([fresh])
    }
    const outside = planDiscoveryObservations({ origin: root, ceiling: 1, urls: [fresh],
      sources: [{ url: root, navigation: inventory([original, fresh]) }], retainedContexts: new Set([publicLinkContext(root, original)]) })
    expect(outside.members.filter(member => member.kind === 'destination').map(member => member.url)).toEqual([fresh])
  })
  it('can commit a bounded observation before the remaining destinations complete', () => {
    const discovery = lifecycleHandlers.find(handler => handler.kind === 'discovery')!
    expect(discovery.replay).toBe('read_only')
    expect(discovery.continuation).toBe(true)
  })
  it('collects shared destinations once while preserving each source page and request query', () => {
    const url = root + 'details?scope=original', variant = root + 'details?scope=other'
    const plan = planDiscoveryObservations({ origin: root, ceiling: 80, urls: [url, url, variant], sources: [
      { url: root, navigation: inventory([url, variant]) }, { url: peer, navigation: inventory([url]) },
    ] })
    expect(plan.members.filter(member => member.kind === 'destination')).toEqual([
      { kind: 'destination', url, sources: [root, peer] }, { kind: 'destination', url: variant, sources: [root] },
    ])
    const observed = discoveryObservations(plan.members, [response(url, 404), response(variant)], execution)
    expect(observed).toHaveLength(2)
    expect(observed.map(item => item.flags[0].pageUrl)).toEqual([root, peer])
    expect(observed[0].flags[0].evidenceTargets).not.toEqual(observed[1].flags[0].evidenceTargets)
  })
  it('retains early and late failures without inventing unknowns for destinations owned by later batches', () => {
    const urls = Array.from({ length: 13 }, (_, index) => root + 'details/' + index)
    const plan = planDiscoveryObservations({ origin: root, ceiling: 80, urls, sources: [{ url: root, navigation: inventory(urls) }] })
    const all = []
    for (let start = 0; start < plan.members.length; start += DISCOVERY_BATCH_SIZE) {
      const members = plan.members.slice(start, start + DISCOVERY_BATCH_SIZE)
      const responses = members.flatMap(member => member.kind === 'destination' ? [response(member.url,
        member.url === urls[0] || member.url === urls.at(-1) ? 404 : 200)] : [])
      const observed = discoveryObservations(members, responses, execution)
      expect(observed.every(item => item.receipt.complete)).toBe(true)
      expect(observed.flatMap(item => item.assertions).every(assertion => assertion.complete)).toBe(true)
      all.push(...observed)
    }
    expect(all.flatMap(item => item.assertions)).toHaveLength(13)
    expect(all.flatMap(item => item.flags)).toHaveLength(2)
    expect(plan.truncated).toBe(false)
  })
  it('keeps omitted destinations and incomplete inventories unknown while allowing exact independently observed repair', () => {
    const urls = [root + 'first', root + 'omitted']
    const plan = planDiscoveryObservations({ origin: root, ceiling: 1, urls, sources: [{ url: root, navigation: inventory(urls, false) }] })
    const before = discoveryObservations(plan.members, [response(urls[0], 404)], execution)[0]
    expect(before).toMatchObject({ complete: false, assertions: [
      { complete: false, passed: false }, { complete: true, passed: false },
    ] })
    expect(plan.truncated).toBe(true)
    const repaired = discoveryObservations(plan.members, [response(urls[0])], execution)[0]
    expect(repaired.complete).toBe(false)
    expect(scopedAssertionForTarget({ receipt: repaired.receipt, checkId: 'broken-internal-links', flag: before.flags[0] })?.assertion)
      .toMatchObject({ complete: true, passed: true })
  })
  it('distinguishes a missing link list from a collected empty inventory', () => {
    const plan = planDiscoveryObservations({ origin: root, ceiling: 80, urls: [], sources: [
      { url: root, navigation: null }, { url: peer, navigation: inventory([]) },
    ] })
    const observed = discoveryObservations(plan.members, [], execution)
    expect(observed[0]).toMatchObject({ complete: false, assertions: [{ passed: false, complete: false }] })
    expect(observed[1]).toMatchObject({ complete: true, assertions: [], flags: [] })
  })
})
