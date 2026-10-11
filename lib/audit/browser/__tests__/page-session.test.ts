import { describe, expect, it, vi } from 'vitest'
import type { Browser, Route } from 'playwright'
import type { JourneyRouteGuardOptions } from '../journey-safety'

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
  attachNetworkMonitor: () => ({ failures: [], resources: [], resourcesTruncated: () => false, dispose: vi.fn() }),
}))
import { createAuditPage } from '../page-session'
import { DESKTOP_CAPTURE_PROFILE } from '../capture-profile'
import { runNetworkEngagementChecks } from '../../checks/network-engagement'

describe('audit page session form evidence', () => {
  it('exposes a probe performed after navigation to the caller and report checks', async () => {
    let intercept!: (route: Route) => Promise<void>
    const page = {
      route: vi.fn(async (_pattern, handler) => { intercept = handler }),
      on: vi.fn(), goto: vi.fn(async () => null), title: vi.fn(async () => 'Example'),
      url: () => 'http://localhost:4100/',
    }
    const context = { newPage: vi.fn(async () => page), addCookies: vi.fn(), once: vi.fn() }
    const browser = { newContext: vi.fn(async () => context) } as unknown as Browser
    const session = await createAuditPage(browser, 'http://localhost:4100/', {
      profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, journeySafe: true, settle: false,
    })
    expect(session.formProbe).toBeNull()
    await intercept({ request: () => ({ url: () => 'http://localhost:4100/api/subscribe' }) } as unknown as Route)
    expect(session.formProbe?.status).toBe(500)
    expect(runNetworkEngagementChecks([], session.formProbe).map(flag => flag.checkId))
      .toEqual(['form-submit-api-server-error'])
  })
  it('blocks worker and socket bypasses only for sessions activating public UI controls', async () => {
    let socketHandler!: (socket: { close(): Promise<void> }) => Promise<void>
    const page = { route: vi.fn(), routeWebSocket: vi.fn(async (_pattern, handler) => { socketHandler = handler }),
      on: vi.fn(), goto: vi.fn(async () => null), title: vi.fn(async () => 'Example'), url: () => 'http://localhost:4100/' }
    const context = { newPage: vi.fn(async () => page), addCookies: vi.fn(), once: vi.fn() }
    const newContext = vi.fn(async () => context)
    const onSafetyRefusal = vi.fn()
    const session = await createAuditPage({ newContext } as unknown as Browser, 'http://localhost:4100/', {
      profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, journeySafe: true, readOnlyInteractions: true, settle: false, onSafetyRefusal,
    })
    expect(newContext).toHaveBeenCalledWith(expect.objectContaining({ serviceWorkers: 'block' }))
    const close = vi.fn().mockResolvedValue(undefined); await socketHandler({ close })
    expect(close).toHaveBeenCalledOnce()
    expect(onSafetyRefusal).toHaveBeenCalledWith('protected_action_requires_fixture')
    expect(session.safetyRestrictions).toEqual(['protected_action_requires_fixture'])
  })

})
