import { beforeEach, describe, expect, it, vi } from 'vitest'

const upsert = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: { siteLifecycleEvent: { upsert } },
}))

import { recordSiteLifecycleEvent, SITE_LIFECYCLE_EVENTS, SITE_EVENT_VERSION } from '../site-events'

describe('Site lifecycle event registry', () => {
  beforeEach(() => upsert.mockReset().mockResolvedValue({ id: 'event-1' }))

  it('covers the critical customer funnel with one versioned registry', () => {
    expect(SITE_EVENT_VERSION).toBe(1)
    expect(SITE_LIFECYCLE_EVENTS).toEqual(expect.arrayContaining([
      'analyze_started',
      'first_useful_result',
      'site_claimed',
      'flag_opened',
      'fix_handoff',
      'verify_started',
      'verify_result',
      'watch_enabled',
      'notification_sent',
      'notification_returned',
      'agent_answered',
      'agent_escalated',
      'support_resolved',
    ]))
  })

  it('stores an idempotency key and strips customer content', async () => {
    await recordSiteLifecycleEvent({
      name: 'agent_answered',
      idempotencyKey: 'agent:1',
      userId: 'u1',
      projectId: 'p1',
      properties: {
        source: 'site_agent',
        routeKind: 'flag',
        rawUrl: 'https://private.example/path',
        email: 'owner@example.com',
        promptText: 'secret',
        evidenceId: 'secret-evidence',
      },
    })

    expect(upsert).toHaveBeenCalledWith({
      where: { idempotencyKey: 'agent:1' },
      create: {
        name: 'agent_answered',
        version: 1,
        idempotencyKey: 'agent:1',
        userId: 'u1',
        projectId: 'p1',
        properties: { source: 'site_agent', routeKind: 'flag' },
      },
      update: {},
    })
  })
})
