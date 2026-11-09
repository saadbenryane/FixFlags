import { describe, expect, it } from 'vitest'
import { lifecycleHandlers } from '../lifecycle'
import { DISCOVERY_BATCH_SIZE, discoveryMemberSchema, planDiscoveryObservations, discoveryObservations, discoveryResponses } from '../discovery'
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
      { kind: 'destination', url: original, sources: [root], extendedBody: true }, { kind: 'destination', url: added[0], sources: [root] },
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
  it('reuses only a conclusive response with the exact URL and body limit and retains its age', () => {
    const shared = root + 'details?scope=original', variant = root + 'details?scope=changed', blocked = root + 'blocked'
    const old = '2026-10-01T10:00:00.000Z'
    const responses = discoveryResponses([response(shared), { ...response(blocked, 429), outcome: 'blocked', shouldFlagDead: false }], new Set())
    const previousResponses = new Map(responses.map(({ key, result }) => [key, { taskId: 'first', collectedAt: old, result }]))
    const input = { origin: root, ceiling: 4, urls: [shared, variant, blocked],
      sources: [{ url: peer, navigation: inventory([shared, variant, blocked]) }], previousResponses }
    const plan = planDiscoveryObservations(input)
    const reused = plan.members.find(member => member.kind === 'destination' && member.url === shared)
    expect(reused).toMatchObject({ reused: { taskId: 'first', collectedAt: old }, sources: [peer] })
    const [observed] = discoveryObservations(plan.members, [response(variant), response(blocked)], execution)
    expect(observed.receipt).toMatchObject({ passed: true, complete: true, execution: { collectedAt: old } })
    expect(plan.members.filter(member => member.kind === 'destination' && member.reused)).toEqual([reused])
    const expanded = planDiscoveryObservations({ ...input, retainedContexts: new Set([publicLinkContext(peer, shared)]) })
    expect(expanded.members.find(member => member.kind === 'destination' && member.url === shared)).toEqual({
      kind: 'destination', url: shared, sources: [peer], extendedBody: true,
    })
  })

  it('uses the fresh GET budget for new destinations while retaining reused assertions', () => {
    const reusedUrls = [root + 'known-a', root + 'known-b']
    const fresh = [root + 'fresh-a', root + 'fresh-b', root + 'omitted']
    const previousResponses = new Map(discoveryResponses(reusedUrls.map(url => response(url)), new Set())
      .map(({ key, result }) => [key, { taskId: 'first', collectedAt: execution.collectedAt, result }]))
    const plan = planDiscoveryObservations({ origin: root, ceiling: 2, urls: [...reusedUrls, ...fresh], previousResponses,
      sources: [{ url: root, navigation: inventory(reusedUrls) }, { url: peer, navigation: inventory([...reusedUrls, ...fresh]) }] })
    const destinations = plan.members.filter(member => member.kind === 'destination')
    expect(destinations.filter(member => member.reused).map(member => member.url)).toEqual(reusedUrls)
    expect(destinations.filter(member => !member.reused).map(member => member.url)).toEqual(fresh.slice(0, 2))
    const observed = discoveryObservations(plan.members, fresh.slice(0, 2).map(url => response(url)), execution)
    expect(observed.find(item => item.receipt.pageUrl === peer)?.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({ context: publicLinkContext(peer, reusedUrls[0]), complete: true }),
      expect.objectContaining({ context: publicLinkContext(peer, fresh[2]), complete: false }),
    ]))
    expect(plan.truncated).toBe(true)
  })

  it('keeps each page inventory bounded and leaves fresh capacity for a declaring peer', () => {
    const reusedUrls = Array.from({ length: 120 }, (_, index) => root + 'known/' + index)
    const fresh = root + 'fresh', ownerless = root + 'ownerless'
    const previousResponses = new Map(discoveryResponses(reusedUrls.map(url => response(url)), new Set())
      .map(({ key, result }) => [key, { taskId: 'first', collectedAt: execution.collectedAt, result }]))
    const plan = planDiscoveryObservations({ origin: root, ceiling: 1, urls: [...reusedUrls, ownerless, fresh], previousResponses,
      sources: [{ url: root, navigation: inventory([...reusedUrls, fresh]) }, { url: peer, navigation: inventory([fresh]) }] })
    const destinations = plan.members.filter(member => member.kind === 'destination')
    expect(destinations.filter(member => member.sources.includes(root))).toHaveLength(120)
    expect(destinations.filter(member => !member.reused)).toEqual([{ kind: 'destination', url: fresh, sources: [peer] }])
    expect(plan.truncated).toBe(true)
  })

  it('shares one expanded observation across pages without widening variants or older checkpoints', () => {
    const url = root + 'details?scope=original', variant = root + 'details?scope=changed'
    const plan = planDiscoveryObservations({ origin: root, ceiling: 2, urls: [url, variant], sources: [
      { url: root, navigation: inventory([url, variant]) }, { url: peer, navigation: inventory([url]) },
    ], retainedContexts: new Set([publicLinkContext(peer, url)]) })
    const destinations = plan.members.filter(member => member.kind === 'destination')
    expect(destinations.map(member => discoveryMemberSchema.parse(member))).toEqual([
      { kind: 'destination', url, sources: [root, peer], extendedBody: true },
      { kind: 'destination', url: variant, sources: [root] },
    ])
    const historical = { kind: 'destination', url, sources: [root, peer] }
    expect(discoveryMemberSchema.parse(historical)).toEqual(historical)
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
