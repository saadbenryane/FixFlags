import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import type { Page, Request, Response } from 'playwright'
import { attachNetworkMonitor } from './network-monitor'
import { bindAuditPageObservation } from './observation-scope'
import { DESKTOP_CAPTURE_PROFILE } from './capture-profile'
import { MAX_ENGAGEMENT_REQUESTS } from '../network-engagement-evidence'

function fixture() {
  const main = {}, embedded = {}, events = new EventEmitter()
  const page = Object.assign(events, { mainFrame: () => main, url: () => 'https://example.com/',
    viewportSize: () => ({ width: DESKTOP_CAPTURE_PROFILE.width, height: DESKTOP_CAPTURE_PROFILE.height }) }) as unknown as Page
  bindAuditPageObservation(page, 'https://example.com/', DESKTOP_CAPTURE_PROFILE, null, [])
  const monitor = attachNetworkMonitor(page, 'https://example.com/')
  function start(url: string, frame: object = main, method = 'GET') {
    const request = { url: () => url, method: () => method, resourceType: () => 'fetch', frame: () => frame,
      failure: () => ({ errorText: 'PRIVATE_URL_OR_CAUSE' }) } as unknown as Request
    events.emit('request', request)
    return { response(status: number, headers = {}) { events.emit('response', { request: () => request, url: () => url, status: () => status, headers: () => headers } as Response) },
      complete() { events.emit('requestfinished', request) }, fail() { events.emit('requestfailed', request) } }
  }
  return { monitor, start, embedded, events }
}

describe('native engagement request collection', () => {
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
    expect(monitor.engagement()).toEqual({ version: 1, requests: [], truncated: false })
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
    monitor.dispose()
  })
  it('awaits already observed transfers without another request and refuses challenge responses as repair evidence', async () => {
    const { monitor, start } = fixture()
    const pending = start('https://example.com/api/contact')
    let settled = false
    const waiting = monitor.settleEngagement(Date.now() + 1000).then(() => { settled = true })
    pending.response(200)
    await Promise.resolve()
    expect(settled).toBe(false)
    pending.complete()
    await waiting
    expect(settled).toBe(true)
    const challenge = start('https://example.com/api/signup')
    challenge.response(200, { 'cf-mitigated': 'challenge' }); challenge.complete()
    expect(monitor.engagement().requests[1].captureKey).toBeUndefined()
    monitor.dispose()
  })
  it('bounds transfer observation and releases pending waits on cancellation and disposal', async () => {
    const { monitor, start } = fixture()
    start('https://example.com/api/contact')
    await monitor.settleEngagement(Date.now() + 5)
    const controller = new AbortController(), cancelled = monitor.settleEngagement(Date.now() + 1000, controller.signal)
    controller.abort(); await cancelled
    const disposed = monitor.settleEngagement(Date.now() + 1000)
    monitor.dispose(); await disposed
    expect(monitor.engagement().requests[0]).toMatchObject({ status: null, state: 'pending' })
  })
})
