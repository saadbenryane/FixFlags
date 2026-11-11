import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import type { Page, Request, Response } from 'playwright'
import { attachNetworkMonitor } from './network-monitor'
import { auditPageObservation, bindAuditPageObservation, captureObservationKey } from './observation-scope'
import { DESKTOP_CAPTURE_PROFILE } from './capture-profile'
import { MAX_ENGAGEMENT_REQUESTS } from '../network-engagement-evidence'
import { trackingRedirectKey, trackingRequestKey } from '../tracking/identity'
import { MAX_TRACKING_REQUESTS } from '../tracking/contracts'
import { runTrackingChecks } from '../checks/tracking'
import { scopedAssertionForTarget } from '../checks/verification'
import { checkReceiptSchema } from '../checks/receipt'
import { networkEngagementObservations } from '../checks/network-engagement'

function fixture(supportsLibraries = true) {
  const main = {}, embedded = {}, events = new EventEmitter()
  const native = Object.assign(new EventEmitter(), { send: async () => {
    if (!supportsLibraries) throw new Error('Native Network is unavailable')
  } })
  const nativeIds = new Map<Request, string>(), currentHop = new Map<string, Request>()
  let nextNativeId = 0
  let pageUrl = 'https://example.com/'
  const page = Object.assign(events, { mainFrame: () => main, url: () => pageUrl,
    viewportSize: () => ({ width: DESKTOP_CAPTURE_PROFILE.width, height: DESKTOP_CAPTURE_PROFILE.height }) }) as unknown as Page
  bindAuditPageObservation(page, 'https://example.com/', DESKTOP_CAPTURE_PROFILE, null, [])
  const monitor = attachNetworkMonitor(page, 'https://example.com/')
  const nativeReady = monitor.observeLibraries(native, 'main')
  function start(url: string, frame: object = main, method = 'GET', resourceType = 'fetch', redirectedFrom: Request | null = null, headers = {}) {
    const request = { url: () => url, method: () => method, resourceType: () => resourceType, frame: () => frame,
      redirectedFrom: () => redirectedFrom, headers: () => headers,
      failure: () => ({ errorText: 'PRIVATE_URL_OR_CAUSE' }) } as unknown as Request
    const requestId = (redirectedFrom && nativeIds.get(redirectedFrom)) || String(++nextNativeId)
    nativeIds.set(request, requestId); currentHop.set(requestId, request)
    native.emit('Network.requestWillBeSent', { requestId, frameId: frame === main ? 'main' : 'embedded',
      type: resourceType === 'script' ? 'Script' : 'Other', request: { url, method }, documentURL: pageUrl,
      ...(redirectedFrom ? { redirectResponse: { status: 302 } } : {}) })
    events.emit('request', request)
    let redirects = false, bodyLength = 1
    return {
      request,
      response(status: number, headers: Record<string, string> = {}) {
        redirects = Boolean(headers.location) && [301, 302, 303, 307, 308].includes(status)
        if (!headers['transfer-encoding'] && headers['content-length'] === '0') bodyLength = 0
        if (!redirects && currentHop.get(requestId) === request)
          native.emit('Network.responseReceived', { requestId, response: { status, headers } })
        events.emit('response', { request: () => request, url: () => url, status: () => status, headers: () => headers } as Response)
      },
      complete(decodedLength = bodyLength) {
        if (!redirects && currentHop.get(requestId) === request) {
          native.emit('Network.dataReceived', { requestId, dataLength: decodedLength })
          native.emit('Network.loadingFinished', { requestId })
        }
        events.emit('requestfinished', request)
      },
      servedFromCache() { native.emit('Network.requestServedFromCache', { requestId }) },
      fail() {
        if (currentHop.get(requestId) === request) native.emit('Network.loadingFailed', { requestId, errorText: 'PRIVATE_URL_OR_CAUSE' })
        events.emit('requestfailed', request)
      },
    }
  }
  return { monitor, start, embedded, events, nativeReady,
    moveTo(url: string) { pageUrl = url },
    captureKey() { return captureObservationKey(auditPageObservation(page)!.scope) },
  }
}

describe('native engagement request collection', () => {
  it.each([
    ['fetch', 'application/json', 200, 'unexpected_html', false, false],
    ['fetch', '*/*', 200, 'unexpected_html', false, false],
    ['xhr', 'text/html; q=0, application/json', 200, 'unexpected_html', false, false],
    ['fetch', 'text/html; q=0.8, application/json', 200, undefined, true, false],
    ['document', '', 200, undefined, true, false],
    ['fetch', '', 204, undefined, true, false],
    ['fetch', '', 503, undefined, false, true],
  ] as const)('qualifies HTML for %s with Accept %s and HTTP %s', (resourceType, accept, status, responseKind, passes, flags) => {
    const { monitor, start } = fixture()
    const request = start('https://example.com/api/contact?token=PRIVATE_REQUEST', undefined, 'GET', resourceType, null, { accept })
    request.response(status, { 'content-type': 'Text/HTML; charset=UTF-8' }); request.complete()
    const observed = monitor.engagement().requests[0]
    expect(observed.status).toBe(status)
    expect(observed.responseKind).toBe(responseKind)
    const result = networkEngagementObservations({ pageUrl: 'https://example.com/', failures: [], evidence: monitor.engagement() })
    expect(result.flags.map(flag => flag.checkId)).toEqual(flags ? ['api-engagement-server-error'] : [])
    expect(result.assertions.find(assertion => assertion.key === 'engagement-server-response'))
      .toMatchObject({ passed: passes, complete: passes || flags })
    monitor.dispose()
  })
  it('withdraws only the exact navigation response when its rendered document is a challenge', () => {
    const { monitor, start } = fixture()
    const url = 'https://example.com/contact'
    const challenge = start(url, undefined, 'GET', 'document')
    const failedApi = start(url)
    for (const transfer of [challenge, failedApi]) { transfer.response(503); transfer.complete() }
    monitor.markNavigationChallenge(challenge.request)
    expect(monitor.engagement().requests.map(request => request.responseKind)).toEqual(['challenge', undefined])
    expect(monitor.failures.map(failure => failure.engagementPath)).toEqual([false, true])
    monitor.dispose()
  })
  it('records response and completed transfer separately, keeps phases, and excludes raw query values', () => {
    const { monitor, start } = fixture()
    const initial = start('https://example.com/api/contact?token=PRIVATE_ORIGINAL')
    initial.response(503)
    expect(monitor.engagement().requests[0]).toMatchObject({ state: 'response', phase: 'page_load', status: 503, captureKey: expect.stringMatching(/^[a-f0-9]{64}$/) })
    monitor.setTrackingPhase('public_action')
    initial.complete()
    const action = start('https://example.com/api/signup?token=PRIVATE_ORIGINAL')
    action.response(200); action.complete()
    expect(monitor.engagement().requests).toMatchObject([{ state: 'completed', phase: 'page_load' }, { state: 'completed', phase: 'public_action' }])
    expect(JSON.stringify(monitor.engagement())).not.toContain('PRIVATE_ORIGINAL')
    monitor.dispose()
  })
  it('requires the exact origin and main frame for comparable evidence', () => {
    const { monitor, start, embedded } = fixture()
    for (const url of ['https://example.com:8443/api/contact', 'http://example.com/api/contact', 'https://other.example/api/contact']) {
      const request = start(url); request.response(500); request.complete()
    }
    const child = start('https://example.com/api/contact', embedded); child.response(500); child.complete()
    expect(monitor.engagement()).toEqual({ version: 3, requests: [], truncated: false })
    expect(monitor.failures.filter(failure => failure.sameOrigin && failure.engagementPath)).toEqual([])
    monitor.dispose()
  })
  it('observes engagement on the reached site origin without attributing off-site requests to the Site', () => {
    const { monitor, start, moveTo, captureKey } = fixture()
    const endpoint = 'https://www.example.com/api/contact?key=PRIVATE_REQUEST'
    moveTo('https://www.example.com/contact')
    const canonical = captureKey(), observed = start(endpoint)
    const offOrigin = start('https://example.com/api/contact')
    moveTo('https://external.example/checkout')
    offOrigin.response(503); offOrigin.complete()
    observed.response(503); observed.complete()
    const external = start('https://example.com/api/contact')
    external.response(503); external.complete()
    expect(monitor.engagement().requests).toMatchObject([
      { captureKey: canonical, destination: 'https://www.example.com/api/contact', status: 503 },
    ])
    expect(monitor.failures.filter(failure => failure.sameOrigin && failure.engagementPath).map(failure => failure.url)).toEqual([endpoint])
    monitor.dispose()
  })
  it('keeps the capture scope of an engagement request that finishes after navigation', () => {
    const { monitor, start, moveTo, captureKey } = fixture()
    monitor.setTrackingPhase('public_action')
    const original = captureKey(), pending = start('https://example.com/api/contact')
    moveTo('https://example.com/next')
    pending.response(503); pending.complete()
    expect(monitor.engagement().requests[0]).toMatchObject({ captureKey: original, phase: 'public_action', status: 503 })
    monitor.dispose()
  })
  it('retains the initiating control across navigation and redirects without borrowing the next control', () => {
    const { monitor, start } = fixture()
    const url = 'https://example.com/api/contact', original = 'a'.repeat(64)
    monitor.setTrackingPhase('public_action')
    const before = start(url)
    monitor.setPublicActionControl('flow:control:' + original)
    const selected = start(url)
    monitor.setPublicActionControl('flow:control:' + 'b'.repeat(64))
    const unscopedHop = start(url + '?step=2', undefined, 'GET', 'fetch', before.request)
    const scopedHop = start(url + '?step=2', undefined, 'GET', 'fetch', selected.request)
    for (const transfer of [before, selected]) { transfer.response(302); transfer.complete() }
    for (const transfer of [unscopedHop, scopedHop]) { transfer.response(200); transfer.complete() }
    const requests = monitor.engagement('public_action').requests
    expect(requests.map(request => request.actionKey)).toEqual([undefined, original])
    expect(requests).toMatchObject(Array.from({ length: 2 }, () => ({
      destination: url, status: 200, state: 'completed',
      redirectKey: trackingRedirectKey(trackingRequestKey(url, 'GET'), url + '?step=2', 'GET'),
    })))
    monitor.dispose()
  })
  it('bounds pending requests, marks truncation and keeps transport failures distinct from success', () => {
    const { monitor, start } = fixture()
    const failed = start('https://example.com/api/contact?first=1')
    failed.response(200); failed.fail()
    for (let index = 0; index < MAX_ENGAGEMENT_REQUESTS; index++) start('https://example.com/api/contact?request=' + index)
    const snapshot = monitor.engagement()
    expect(snapshot.truncated).toBe(true)
    expect(snapshot.requests).toHaveLength(MAX_ENGAGEMENT_REQUESTS)
    expect(snapshot.requests[0]).toMatchObject({ status: 200, state: 'failed' })
    expect(JSON.stringify(snapshot)).not.toContain('PRIVATE_URL_OR_CAUSE')
    monitor.setTrackingPhase('public_action')
    const action = start('https://example.com/api/contact?action=1')
    action.response(200); action.complete()
    expect(monitor.engagement('public_action')).toMatchObject({ truncated: false, requests: [{ phase: 'public_action', status: 200 }] })
    expect(monitor.engagement('page_load')).toMatchObject({ truncated: true })
    monitor.dispose()
  })
  it('awaits already observed transfers without another request and refuses challenge responses as repair evidence', async () => {
    const { monitor, start } = fixture()
    const pending = start('https://example.com/api/contact')
    let settled = false
    const waiting = monitor.settleNetwork(Date.now() + 1000, { engagement: 'all' }).then(() => { settled = true })
    pending.response(200)
    await Promise.resolve()
    expect(settled).toBe(false)
    start('https://example.com/api/contact?late=1')
    pending.complete()
    await new Promise(resolve => setImmediate(resolve))
    expect(settled).toBe(true)
    await waiting
    expect(monitor.engagement().requests[1]).toMatchObject({ status: null, state: 'pending' })
    const challenge = start('https://example.com/api/signup')
    challenge.response(403, { 'cf-mitigated': 'Challenge' }); challenge.complete()
    expect(monitor.engagement().requests[2]).toMatchObject({ responseKind: 'challenge', status: 403 })
    expect(monitor.failures.some(failure => failure.sameOrigin && failure.engagementPath)).toBe(false)
    monitor.dispose()
  })
  it('bounds transfer observation and releases pending waits on cancellation and disposal', async () => {
    const { monitor, start } = fixture()
    start('https://example.com/api/contact')
    await monitor.settleNetwork(Date.now() + 5, { engagement: 'all' })
    const controller = new AbortController(), cancelled = monitor.settleNetwork(Date.now() + 1000, { engagement: 'all', signal: controller.signal })
    controller.abort(); await cancelled
    const disposed = monitor.settleNetwork(Date.now() + 1000, { engagement: 'all' })
    monitor.dispose(); await disposed
    expect(monitor.engagement().requests[0]).toMatchObject({ status: null, state: 'pending' })
  })
})

it.each([200, 503])('retains HTTP %i from a library transfer that finishes after the action observation', async status => {
  const { monitor, start } = fixture()
  start('https://example.com/_vercel/insights/script.js?phase=load', undefined, 'GET', 'script')
  monitor.setTrackingPhase('public_action')
  const library = start('https://example.com/_vercel/insights/script.js', undefined, 'GET', 'script')
  const event = start('https://example.com/_vercel/insights/view', undefined, 'POST')
  monitor.suppressTracking(event.request)
  let settled = false
  const waiting = monitor.settleNetwork(Date.now() + 1000, { engagement: 'public_action', tracking: 'public_action' }).then(() => { settled = true })
  await new Promise(resolve => setImmediate(resolve))
  expect(settled).toBe(false)
  start('https://example.com/_vercel/insights/script.js?phase=late', undefined, 'GET', 'script')
  library.response(status)
  if (status === 200) {
    await new Promise(resolve => setImmediate(resolve))
    expect(settled).toBe(false)
    library.complete()
  }
  await new Promise(resolve => setImmediate(resolve))
  expect(settled).toBe(true)
  await waiting
  const result = runTrackingChecks(null, monitor.tracking('public_action'), 'https://example.com/')
  expect(result.assertions.filter(assertion => assertion.key === 'tracking-library')).toMatchObject([
    { complete: true, passed: status === 200 }, { complete: false, passed: false },
  ])
  expect(result.flags.map(flag => flag.checkId)).toEqual(status === 503 ? ['tracking-library-http-error'] : [])
  monitor.dispose()
})

it('waits for the library redirect destination and ignores late events from earlier hops', async () => {
  const { monitor, start } = fixture()
  const initial = start('https://example.com/_vercel/insights/script.js', undefined, 'GET', 'script')
  const url = 'https://cdn.segment.com/analytics.js/v1/PRIVATE_PROJECT/analytics.min.js'
  let settled = false
  const waiting = monitor.settleNetwork(Date.now() + 1000, { tracking: 'page_load' }).then(() => { settled = true })
  initial.response(302, { location: url }); initial.complete()
  await new Promise(resolve => setImmediate(resolve))
  expect(settled).toBe(false)
  expect(monitor.tracking().requests).toMatchObject([{ state: 'pending', status: null }])
  const recognized = start(url, undefined, 'GET', 'script', initial.request)
  expect(monitor.tracking().requests).toMatchObject([{ provider: 'segment', state: 'pending', status: null,
    requestKey: trackingRedirectKey(trackingRequestKey(initial.request.url(), 'GET'), url, 'GET') }])
  recognized.response(302, { 'cf-mitigated': 'challenge' })
  const terminal = start('https://cdn.example.com/PRIVATE_PATH.js', undefined, 'GET', 'script', recognized.request)
  recognized.complete(); initial.fail()
  expect(monitor.tracking().requests).toMatchObject([{ provider: 'segment', state: 'pending', status: null, redirected: true }])
  expect(monitor.tracking().requests[0].responseKind).toBeUndefined()
  terminal.fail()
  await waiting
  expect(monitor.tracking().requests).toMatchObject([{ provider: 'segment', state: 'failed', status: null, redirected: true }])
  expect(JSON.stringify(monitor.tracking())).not.toContain('PRIVATE_')
  monitor.dispose()
})

it('keeps a library redirect distinct from a recognized event request', () => {
  const { monitor, start } = fixture(), url = 'https://example.com/'
  const library = start(url + '_vercel/insights/script.js', undefined, 'GET', 'script')
  const destination = url + '_vercel/insights/view?private=event'
  library.response(302, { location: destination }); library.complete()
  const event = start(destination, undefined, 'GET', 'script', library.request)
  monitor.suppressTracking(event.request)
  const evidence = monitor.tracking()
  expect(evidence.requests).toMatchObject([
    { role: 'library', status: 302, state: 'pending' }, { role: 'event', status: null, state: 'suppressed' },
  ])
  expect(runTrackingChecks(null, evidence, url).assertions.find(item => item.key === 'tracking-library'))
    .toMatchObject({ complete: false, passed: false })
  expect(JSON.stringify(evidence)).not.toContain('private=')
  monitor.dispose()
})

it('requires the original redirect chain to verify a recognized library repair', () => {
  const pageUrl = 'https://example.com/'
  const destination = 'https://cdn.segment.com/analytics.js/v1/PRIVATE_LIBRARY/analytics.min.js'
  function observe(initiator: string | null, status: number) {
    const { monitor, start } = fixture()
    const initial = initiator ? start(initiator, undefined, 'GET', 'script') : null
    initial?.response(302, { location: destination })
    initial?.complete()
    const terminal = start(destination, undefined, 'GET', 'script', initial?.request)
    terminal.response(status); terminal.complete()
    const result = runTrackingChecks(null, monitor.tracking(), pageUrl)
    monitor.dispose()
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'measurement', pageUrl,
      applicable: true, passed: !result.flags.length, complete: result.complete, assertions: result.assertions,
      execution: { auditId: 'audit', taskId: 'check', checkVersion: 1, source: 'browser-network', collectedAt: new Date().toISOString() } })
    return { ...result, receipt }
  }
  const original = pageUrl + '_vercel/insights/script.js?project=PRIVATE_ORIGINAL'
  const before = observe(original, 503)
  const checkId = 'tracking-library-http-error'
  expect(before.flags).toMatchObject([{ checkId }])
  const compare = (initiator: string | null) => scopedAssertionForTarget({ receipt: observe(initiator, 200).receipt, checkId, flag: before.flags[0] })
  expect(compare(null)).toBeUndefined()
  expect(compare(pageUrl + '_vercel/insights/script.js?project=PRIVATE_OTHER')).toBeUndefined()
  expect(compare(original)?.assertion).toMatchObject({ complete: true, passed: true })
  const untracked = observe(pageUrl + 'unrecognized.js', 503)
  expect(untracked.flags).toMatchObject([{ checkId }])
  expect(untracked.flags[0].verificationRule).toContain('without the conditions required')
  expect(JSON.stringify([before, untracked])).not.toContain('PRIVATE_')
})

it('keeps independent bounded Tracking evidence for loading and public actions', () => {
  const { monitor, start } = fixture()
  for (let index = 0; index <= MAX_TRACKING_REQUESTS; index++) {
    const event = start('https://www.google-analytics.com/g/collect?i=' + index)
    monitor.suppressTracking(event.request)
  }
  monitor.setTrackingPhase('public_action')
  const library = start('https://example.com/_vercel/insights/script.js', undefined, 'GET', 'script')
  library.response(503); library.complete()
  expect(monitor.tracking('page_load').requests).toHaveLength(MAX_TRACKING_REQUESTS)
  expect(monitor.tracking('page_load').truncated).toBe(true)
  expect(monitor.tracking('public_action')).toMatchObject({ truncated: false,
    requests: [{ phase: 'public_action', role: 'library', status: 503, state: 'completed' }] })
  monitor.dispose()
})

it('keeps the initiating document when requests finish or redirect after navigation', () => {
  const { monitor, start, moveTo, captureKey } = fixture()
  const url = 'https://example.com/_vercel/insights/script.js'
  monitor.setTrackingPhase('public_action')
  const original = captureKey(), initial = start(url, undefined, 'GET', 'script')
  moveTo('https://example.com/next?token=PRIVATE_DOCUMENT')
  const next = captureKey(), later = start(url, undefined, 'GET', 'script')
  const destination = 'https://cdn.example.com/script.js'
  initial.response(302, { location: destination }); initial.complete()
  const hop = start(destination, undefined, 'GET', 'script', initial.request)
  hop.response(503); hop.complete()
  later.response(200); later.complete()
  expect(monitor.tracking().requests).toMatchObject([
    { captureKey: original, redirected: true, status: 503 },
    { captureKey: next, status: 200 },
  ])
  expect(original).not.toBe(next)
  expect(JSON.stringify(monitor.tracking())).not.toContain('PRIVATE_DOCUMENT')
  monitor.dispose()
})

it('keeps the control at request start across phase changes and redirects', () => {
  const { monitor, start } = fixture()
  const url = 'https://example.com/_vercel/insights/script.js'
  const original = 'a'.repeat(64), next = 'b'.repeat(64)
  monitor.setTrackingPhase('public_action')
  const beforeClick = start(url, undefined, 'GET', 'script')
  const unrecognized = start('https://cdn.example.com/initial.js', undefined, 'GET', 'script')
  monitor.setPublicActionControl('flow:control:' + original)
  const initiated = start(url, undefined, 'GET', 'script')
  monitor.setPublicActionControl('flow:control:' + next)
  const later = start(url, undefined, 'GET', 'script')
  const redirect = start('https://cdn.example.com/script.js', undefined, 'GET', 'script', initiated.request)
  const returnedHop = start(url, undefined, 'GET', 'script', redirect.request)
  const unscopedHop = start(url, undefined, 'GET', 'script', unrecognized.request)
  monitor.setPublicActionControl(null)
  const afterClick = start(url, undefined, 'GET', 'script')
  for (const transfer of [beforeClick, later, returnedHop, unscopedHop, afterClick]) {
    transfer.response(200); transfer.complete()
  }
  expect(monitor.tracking().requests.map(request => request.actionKey)).toEqual([undefined, original, next, undefined, undefined])
  monitor.dispose()
})

it.each([
  [200, 'html', { 'content-type': 'text/html; charset=UTF-8' }],
  [200, 'empty', { 'content-type': 'application/javascript', 'content-length': '0' }],
  [200, 'script_mime', { 'content-type': 'application/json', 'x-content-type-options': 'NoSniff' }],
  [200, 'script_mime', { 'x-content-type-options': 'nosniff' }],
  [200, 'challenge', { 'cf-mitigated': 'Challenge', 'content-type': 'application/javascript' }],
  [503, 'challenge', { 'cf-mitigated': 'challenge' }],
] as const)('retains HTTP %s without certifying a library response of kind %s with headers %j', (status, responseKind, headers) => {
  const { monitor, start } = fixture()
  const url = 'https://example.com/'
  const library = start(url + '_vercel/insights/script.js', undefined, 'GET', 'script')
  library.response(status, headers); library.complete()
  const evidence = monitor.tracking()
  const result = runTrackingChecks(null, evidence, url, { hasAnalytics: true })
  expect(result.assertions.find(item => item.key === 'tracking-library')).toMatchObject({ complete: false, passed: false })
  expect(result.complete).toBe(false)
  expect(result.flags).toEqual([])
  expect(evidence.requests).toMatchObject([{ role: 'library', state: 'completed', status, responseKind }])
  expect(JSON.stringify(evidence)).not.toContain('content-type')
  monitor.dispose()
})

it.each([
  { 'content-type': 'Application/X-JavaScript; charset=UTF-8', 'x-content-type-options': 'nosniff' },
  { 'content-type': 'text/plain' },
  { 'content-type': 'application/javascript', 'content-length': '0', 'transfer-encoding': 'chunked' },
])('retains a completed script transfer without inferring an empty or blocked response from %o', headers => {
  const { monitor, start } = fixture()
  const url = 'https://example.com/'
  const library = start(url + '_vercel/insights/script.js', undefined, 'GET', 'script')
  library.response(200, headers); library.complete()
  const evidence = monitor.tracking()
  expect(evidence.requests[0].responseKind).toBeUndefined()
  expect(runTrackingChecks(null, evidence, url, { hasAnalytics: true }).assertions.find(item => item.key === 'tracking-library'))
    .toMatchObject({ complete: true, passed: true })
  monitor.dispose()
})

it('does not lend decoded bytes between concurrent requests to the same library URL', () => {
  const { monitor, start } = fixture()
  const pageUrl = 'https://example.com/', url = pageUrl + '_vercel/insights/script.js'
  const empty = start(url, undefined, 'GET', 'script')
  const filled = start(url, undefined, 'GET', 'script')
  empty.response(200); filled.response(200)
  filled.complete(1); empty.complete(0)
  const evidence = monitor.tracking()
  expect(evidence.requests).toMatchObject([{ responseKind: 'empty' }, { libraryResponseQualified: true }])
  expect(runTrackingChecks(null, evidence, pageUrl).assertions.find(item => item.key === 'tracking-library'))
    .toMatchObject({ complete: false, passed: false })
  monitor.dispose()
})

it('leaves a cached library inconclusive even when Chromium supplies body bytes', () => {
  const { monitor, start } = fixture()
  const pageUrl = 'https://example.com/'
  const library = start(pageUrl + '_vercel/insights/script.js', undefined, 'GET', 'script')
  library.servedFromCache()
  library.response(200); library.complete()
  const evidence = monitor.tracking()
  expect(evidence.requests[0]).toMatchObject({ status: 200, state: 'completed' })
  expect(evidence.requests[0].libraryResponseQualified).toBeUndefined()
  expect(runTrackingChecks(null, evidence, pageUrl).assertions.find(item => item.key === 'tracking-library'))
    .toMatchObject({ complete: false, passed: false })
  monitor.dispose()
})

it('leaves the library observation incomplete if native collection is unavailable', async () => {
  const { monitor, start, nativeReady } = fixture(false)
  await nativeReady
  const pageUrl = 'https://example.com/'
  const engagement = start(pageUrl + 'api/contact')
  engagement.response(200); engagement.complete()
  expect(monitor.engagement().requests).toMatchObject([{ status: 200, state: 'completed' }])
  const result = runTrackingChecks(null, monitor.tracking(), pageUrl, { hasAnalytics: true })
  expect(result.complete).toBe(false)
  expect(result.assertions.find(item => item.key === 'tracking-library')).toMatchObject({
    complete: false, observed: expect.stringContaining('could not collect library transfer evidence'),
  })
  monitor.dispose()
})
