import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorizeCanvasAccess } from '@/lib/canvas/authorization'

afterEach(() => {
  vi.unstubAllEnvs()
})

const paidOwner = {
  id: 'owner-1',
  role: 'user',
  plan: 'BUILDER',
  subscriptionStatus: 'ACTIVE',
} as const

describe('authorizeCanvasAccess', () => {
  it('requires authentication and ownership', () => {
    expect(authorizeCanvasAccess({ actor: null, projectOwnerId: 'owner-1' })).toEqual({ allowed: false, reason: 'AUTH_REQUIRED' })
    expect(authorizeCanvasAccess({ actor: { ...paidOwner, id: 'other' }, projectOwnerId: 'owner-1' })).toEqual({ allowed: false, reason: 'OWNER_REQUIRED' })
  })

  it('reuses paid entitlement behavior', () => {
    vi.stubEnv('DEV_SIMULATE_BILLING', 'true')
    expect(authorizeCanvasAccess({ actor: { ...paidOwner, plan: 'FREE' }, projectOwnerId: 'owner-1' })).toEqual({ allowed: false, reason: 'PAID_PLAN_REQUIRED' })
    expect(authorizeCanvasAccess({ actor: { ...paidOwner, subscriptionStatus: 'PAST_DUE' }, projectOwnerId: 'owner-1' })).toEqual({ allowed: false, reason: 'PAID_PLAN_REQUIRED' })
    expect(authorizeCanvasAccess({ actor: paidOwner, projectOwnerId: 'owner-1' })).toEqual({ allowed: true })
  })

  it('allows an entitled admin to operate a private Canvas', () => {
    vi.stubEnv('DEV_SIMULATE_BILLING', 'true')
    expect(authorizeCanvasAccess({
      actor: { ...paidOwner, id: 'admin-1', role: 'admin', plan: 'FREE' },
      projectOwnerId: 'owner-1',
    })).toEqual({ allowed: true })
  })
})
