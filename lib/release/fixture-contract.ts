import { createHash } from 'node:crypto'
import type { Plan, SubscriptionStatus } from '@prisma/client'

export type ReleaseFixtureRole = {
  key: 'free' | 'pro' | 'studio' | 'share' | 'watch' | 'github' | 'twoFactor' | 'waitlistReleased' | 'waitlistBlocked' | 'nonMember'
  plan: Plan
  subscriptionStatus: SubscriptionStatus
}

export const RELEASE_FIXTURE_ROLES: ReleaseFixtureRole[] = [
  { key: 'free', plan: 'FREE', subscriptionStatus: 'NONE' },
  { key: 'pro', plan: 'BUILDER', subscriptionStatus: 'NONE' },
  { key: 'studio', plan: 'TEAM', subscriptionStatus: 'NONE' },
  { key: 'share', plan: 'TEAM', subscriptionStatus: 'NONE' },
  { key: 'watch', plan: 'TEAM', subscriptionStatus: 'NONE' },
  { key: 'github', plan: 'TEAM', subscriptionStatus: 'NONE' },
  { key: 'twoFactor', plan: 'BUILDER', subscriptionStatus: 'NONE' },
  { key: 'waitlistReleased', plan: 'FREE', subscriptionStatus: 'NONE' },
  { key: 'waitlistBlocked', plan: 'FREE', subscriptionStatus: 'NONE' },
  { key: 'nonMember', plan: 'FREE', subscriptionStatus: 'NONE' },
]

export function canonicalReleaseDatabaseIdentity(databaseUrl: string): string {
  const parsed = new URL(databaseUrl)
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('Release fixtures require PostgreSQL')
  }
  const port = parsed.port || '5432'
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  if (!database || !/(release|test)/i.test(database)) {
    throw new Error('Release fixture database name must include release or test')
  }
  return `${parsed.hostname.toLowerCase()}:${port}/${database}`
}

export function releaseDatabaseIdentityHash(databaseUrl: string): string {
  return createHash('sha256').update(canonicalReleaseDatabaseIdentity(databaseUrl)).digest('hex')
}

export function assertNonProductionReleaseTarget(value: string): string {
  const origin = new URL(value).origin
  if (new URL(origin).hostname === 'fixflags.com' || new URL(origin).hostname === 'www.fixflags.com') {
    throw new Error('Release fixtures must never target production')
  }
  return origin
}
