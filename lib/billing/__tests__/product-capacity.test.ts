import { describe, expect, it, vi } from 'vitest'
import { assertCanCreateProduct, ProductLimitReached } from '@/lib/billing/product-capacity'
import { projectLimitForPlan } from '@/lib/billing/plans'
import { siteCarePolicy } from '@/lib/sites/application/care-policy'
import type { Plan, SubscriptionStatus } from '@prisma/client'

type CareAccount = {
  plan?: Plan
  subscriptionStatus?: SubscriptionStatus
  role?: string
}

function client(account: CareAccount, count: number) {
  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    user: {
      findUnique: vi.fn().mockResolvedValue({
        plan: account.plan ?? 'FREE',
        subscriptionStatus: account.subscriptionStatus ?? 'ACTIVE',
        role: account.role ?? 'user',
      }),
    },
    project: { count: vi.fn().mockResolvedValue(count) },
  }
}

describe('Product capacity', () => {
  it('blocks a second Product on Free', async () => {
    const tx = client({ plan: 'FREE' }, 1)
    await expect(assertCanCreateProduct(tx as never, 'user-1')).rejects.toEqual(
      new ProductLimitReached(1)
    )
  })

  it('blocks a sixth Product on Pro', async () => {
    const tx = client({ plan: 'BUILDER' }, 5)
    await expect(assertCanCreateProduct(tx as never, 'user-1')).rejects.toEqual(
      new ProductLimitReached(5)
    )
  })

  it('does not count Products for Studio', async () => {
    const tx = client({ plan: 'TEAM' }, 500)
    await expect(assertCanCreateProduct(tx as never, 'user-1')).resolves.toBeUndefined()
    expect(tx.project.count).not.toHaveBeenCalled()
  })

  it('applies the Free Site cap while a paid subscription is revoked', async () => {
    const tx = client({ plan: 'BUILDER', subscriptionStatus: 'PAST_DUE' }, 5)
    await expect(assertCanCreateProduct(tx as never, 'user-1')).rejects.toEqual(
      new ProductLimitReached(1)
    )
  })
})

describe('Site cap has one source of truth', () => {
  const PLANS: Plan[] = ['FREE', 'BUILDER', 'TEAM']

  it('enforces exactly the Site cap the care policy states', () => {
    for (const plan of PLANS) {
      expect(siteCarePolicy({ role: 'user', plan, subscriptionStatus: 'ACTIVE' }).maxSites).toBe(
        projectLimitForPlan(plan)
      )
    }
  })

  it('keeps the care policy and the plan definition on the same cap', () => {
    for (const plan of PLANS) {
      const policy = siteCarePolicy({ role: 'user', plan, subscriptionStatus: 'ACTIVE' })
      const sold = projectLimitForPlan(plan)
      // Guards the two former sources of truth: enforcement must never sell more
      // Sites than the policy states.
      expect(
        policy.maxSites,
        `care policy and plan definition disagree on the ${plan} Site cap`
      ).toBe(sold)
    }
  })
})
