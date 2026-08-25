import { describe, expect, it } from 'vitest'
import { authorizeCanvasAccess } from '@/lib/canvas/authorization'

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

  it('allows every plan because Canvas is a shared web capability', () => {
    expect(authorizeCanvasAccess({ actor: { ...paidOwner, plan: 'FREE' }, projectOwnerId: 'owner-1' })).toEqual({ allowed: true })
    expect(authorizeCanvasAccess({ actor: { ...paidOwner, subscriptionStatus: 'PAST_DUE' }, projectOwnerId: 'owner-1' })).toEqual({ allowed: true })
    expect(authorizeCanvasAccess({ actor: paidOwner, projectOwnerId: 'owner-1' })).toEqual({ allowed: true })
  })

  it('allows an admin to operate a private Canvas', () => {
    expect(authorizeCanvasAccess({
      actor: { ...paidOwner, id: 'admin-1', role: 'admin', plan: 'FREE' },
      projectOwnerId: 'owner-1',
    })).toEqual({ allowed: true })
  })
})
