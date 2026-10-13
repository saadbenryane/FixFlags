import { isAdminUser } from '@/lib/auth/permissions'
import type { EntitlementGrant, Prisma, User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { hasOpenBetaAccess } from './beta-policy'
import { projectLimitForPlan, scanLimitForPlan, deepReviewLimitForPlan } from './plans'

export type EffectiveEntitlements = {
  available: boolean
  plan: User['plan']
  maxSites: number | null
  scanLimit: number | null
  deepReviewLimit: number | null
  watchIntervals: Array<'weekly' | 'daily' | 'hourly' | 'custom'>
  sources: string[]
  grantIds: string[]
}
type EntitlementAccount = Pick<
  User,
  | 'id'
  | 'role'
  | 'plan'
  | 'subscriptionStatus'
  | 'lifecycleStatus'
  | 'auditsLimit'
  | 'deepReviewsLimit'
  | 'licensedSiteQuantity'
>
const ranks = { FREE: 0, BUILDER: 1, TEAM: 2 }
const intervals = ['weekly', 'daily', 'hourly', 'custom'] as const

export function resolveEffectiveEntitlements(
  user: EntitlementAccount,
  grants: EntitlementGrant[],
  now = new Date(),
): EffectiveEntitlements {
  if (user.lifecycleStatus !== 'ACTIVE')
    return {
      available: false,
      plan: user.plan,
      maxSites: 0,
      scanLimit: 0,
      deepReviewLimit: 0,
      watchIntervals: [],
      sources: [user.lifecycleStatus],
      grantIds: [],
    }
  const paid = ['ACTIVE', 'TRIALING'].includes(user.subscriptionStatus)
  const basePlan = ['PAST_DUE', 'CANCELED', 'UNPAID'].includes(user.subscriptionStatus)
    ? 'FREE'
    : user.plan
  const beta = hasOpenBetaAccess(user),
    admin = isAdminUser(user)
  const active = grants.filter((grant) => !grant.revokedAt && grant.expiresAt > now)
  const plan = active.reduce(
    (selected, grant) =>
      grant.plan && ranks[grant.plan] > ranks[selected] ? grant.plan : selected,
    basePlan,
  )
  const cap = projectLimitForPlan(plan)
  let maxSites: number | null =
    admin || cap === null ? null : Math.max(cap!, paid ? user.licensedSiteQuantity : 0)
  let scanLimit: number | null =
    admin || beta || user.auditsLimit === -1
      ? null
      : Math.max(user.auditsLimit, scanLimitForPlan(plan))
  let deepReviewLimit: number | null =
    admin || beta || user.deepReviewsLimit === -1
      ? null
      : Math.max(user.deepReviewsLimit, deepReviewLimitForPlan(plan))
  const allowed = new Set<string>(admin || beta || plan !== 'FREE' ? intervals : ['weekly'])
  for (const grant of active) {
    if (maxSites !== null && grant.siteAllowance !== null)
      maxSites = Math.max(maxSites, grant.siteAllowance)
    if (scanLimit !== null && grant.scanAllowance !== null)
      scanLimit = Math.max(scanLimit, grant.scanAllowance)
    if (deepReviewLimit !== null && grant.deepReviewAllowance !== null)
      deepReviewLimit = Math.max(deepReviewLimit, grant.deepReviewAllowance)
    for (const interval of grant.allowedWatchIntervals)
      if (intervals.includes(interval as (typeof intervals)[number])) allowed.add(interval)
  }
  return {
    available: true,
    plan,
    maxSites,
    scanLimit,
    deepReviewLimit,
    watchIntervals: intervals.filter((interval) => allowed.has(interval)),
    sources: [
      ...(admin ? ['ADMIN'] : []),
      ...(beta ? ['OPEN_BETA'] : []),
      ...(paid ? ['SUBSCRIPTION'] : ['FREE']),
      ...(active.length ? ['COMPLIMENTARY_ACCESS'] : []),
    ],
    grantIds: active.map((grant) => grant.id),
  }
}

export async function loadEffectiveEntitlements(
  userId: string,
  db: Prisma.TransactionClient = prisma,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { entitlementGrants: { where: { revokedAt: null, expiresAt: { gt: new Date() } } } },
  })
  return user ? resolveEffectiveEntitlements(user, user.entitlementGrants) : null
}
