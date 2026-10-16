import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { Browser, Route } from 'playwright'
import type { JourneyRouteGuardOptions } from '../journey-safety'

describe('explicit localhost fixture boundary', () => {
  it.each(['http://localhost:4100/path', 'https://127.0.0.1/path'])('accepts a literal fixture host: %s', url => {
    expect(isLocalhostAuditUrl(url)).toBe(true)
  })
  it.each(['http://localhost.attacker.test/', 'http://127.0.0.1.attacker.test/', 'http://localhost@attacker.test/',
    'http://localhost:4100@attacker.test/', 'file://localhost/path', 'not a URL'])('refuses a lookalike or non-HTTP target: %s', url => {
    expect(isLocalhostAuditUrl(url)).toBe(false)
  })
})

vi.mock('../../progressive/capacity', () => ({ browserCapacity: { acquire: vi.fn(async () => vi.fn()) } }))
vi.mock('../request-boundary', () => ({ installRequestBoundary: vi.fn() }))

vi.mock('../journey-safety', () => ({
  blockFormSubmits: vi.fn(),
  applyJourneyRouteGuards: vi.fn(async (_route, _continue, options: JourneyRouteGuardOptions) => {
    if (options.formProbe) {
      options.formProbe.probed = true
      options.formProbe.result = {
        url: 'http://localhost:4100/api/subscribe', method: 'POST', status: 500,
      }
    }
  }),
}))
vi.mock('../network-monitor', () => ({
  attachNetworkMonitor: () => ({ failures: [], resources: [], resourcesTruncated: () => false, tracking: vi.fn(), setTrackingPhase: vi.fn(), suppressTracking: vi.fn(), dispose: vi.fn() }),
}))
import { createAuditPage, isLocalhostAuditUrl } from '../page-session'
import { installRequestBoundary } from '../request-boundary'
import { DESKTOP_CAPTURE_PROFILE } from '../capture-profile'
import { runNetworkEngagementChecks } from '../../checks/network-engagement'

describe('audit page session form evidence', () => {
  it('retains distinct full-message identities when clipped text collides, and records the last failure horizon', async () => {
    const callbacks = new Map<string, (event?: unknown) => void>()
    const page = { route: vi.fn(), on: (event: string, handler: (event?: unknown) => void) => callbacks.set(event, handler),
      once: (event: string, handler: () => void) => callbacks.set(event, handler),
      goto: vi.fn(async () => null), title: vi.fn(async () => 'Example'), url: () => 'http://localhost:4100/' }
    const context = { newPage: vi.fn(async () => page), addCookies: vi.fn(), once: vi.fn() }
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(100_000)
      const session = await createAuditPage(Object.assign(new EventEmitter(), { newContext: vi.fn(async () => context) }) as unknown as Browser, 'http://localhost:4100/', {
        profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, settle: false, consoleIdentityKey: 'fixture-only-key',
      })
      callbacks.get('load')!()
      vi.setSystemTime(104_000)
      const first = 'x'.repeat(2100) + 'first', second = 'x'.repeat(2100) + 'second'
      callbacks.get('pageerror')!(new Error(first)); callbacks.get('pageerror')!(new Error(second)); callbacks.get('pageerror')!(new Error(first))
      expect(session.consoleErrors).toHaveLength(2)
      expect(session.consoleErrors[0].text).toBe(session.consoleErrors[1].text)
      expect(session.consoleErrors[0].identity).not.toBe(session.consoleErrors[1].identity)
      expect(session.consoleTiming()).toEqual({ loaded: true, observedMs: 4000, minimumMs: 5000 })
      expect(session.consoleTruncated()).toBe(true)
      for (let index = 0; index < 505; index++) callbacks.get('pageerror')!(new Error('Flood ' + index))
      expect(session.consoleErrors).toHaveLength(500)
    } finally { vi.useRealTimers() }
  })
  it('exposes a probe performed after navigation to the caller and report checks', async () => {
    const page = {
      route: vi.fn(),
      on: vi.fn(), once: vi.fn(), goto: vi.fn(async () => null), title: vi.fn(async () => 'Example'),
      url: () => 'http://localhost:4100/',
    }
    const context = { newPage: vi.fn(async () => page), addCookies: vi.fn(), once: vi.fn() }
    const browser = Object.assign(new EventEmitter(), { newContext: vi.fn(async () => context) }) as unknown as Browser
    const session = await createAuditPage(browser, 'http://localhost:4100/', {
      profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, journeySafe: true, settle: false,
    })
    expect(session.formProbe).toBeNull()
    await vi.mocked(installRequestBoundary).mock.lastCall![3]({ request: () => ({ url: () => 'http://localhost:4100/api/subscribe', resourceType: () => 'fetch', method: () => 'POST', isNavigationRequest: () => false }) } as unknown as Route)
    expect(session.formProbe?.status).toBe(500)
    expect(runNetworkEngagementChecks([], session.formProbe).map(flag => flag.checkId))
      .toEqual(['form-submit-api-server-error'])
  })
  it('blocks worker and socket bypasses only for sessions activating public UI controls', async () => {
    let socketHandler!: (socket: { close(): Promise<void> }) => Promise<void>
    const page = { route: vi.fn(),
      on: vi.fn(), once: vi.fn(), goto: vi.fn(async () => null), title: vi.fn(async () => 'Example'), url: () => 'http://localhost:4100/' }
    const context = { newPage: vi.fn(async () => page), addCookies: vi.fn(), once: vi.fn(),
      routeWebSocket: vi.fn(async (_pattern, handler) => { socketHandler = handler }) }
    const newContext = vi.fn(async () => context)
    const onSafetyRefusal = vi.fn()
    const session = await createAuditPage(Object.assign(new EventEmitter(), { newContext }) as unknown as Browser, 'http://localhost:4100/', {
      profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, journeySafe: true, readOnlyInteractions: true, settle: false, onSafetyRefusal,
    })
    expect(newContext).toHaveBeenCalledWith(expect.objectContaining({ serviceWorkers: 'block' }))
    const close = vi.fn().mockResolvedValue(undefined); await socketHandler({ close })
    expect(close).toHaveBeenCalledOnce()
    expect(onSafetyRefusal).toHaveBeenCalledWith('protected_action_requires_fixture')
    expect(session.safetyRestrictions).toEqual(['protected_action_requires_fixture'])
  })

})
