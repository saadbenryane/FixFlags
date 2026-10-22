import type { Project } from '@prisma/client'
import { toStoredWatchInterval } from '@/lib/audit/watch-interval'
import type { WatchInterval } from '../watch-schedule'
import { SiteRunRefusal } from './run-refusal'

/** Internal scheduler authority. Never part of a public run request or its evidence. */
export type ScheduledRunClaim = {
  targetUrl: string
  interval: WatchInterval
  everyMinutes: number | null
  scheduledAt: Date
  attemptedAt: Date
  leaseUntil: Date
}

export type ScheduledClaimProject = Pick<Project, 'url' | 'watchInterval' | 'watchEveryMinutes' |
  'watchNextRunAt' | 'watchLastAttemptAt' | 'watchLeaseUntil'>

export function staleScheduledClaim(): SiteRunRefusal {
  return new SiteRunRefusal('The monitoring schedule changed before this check could start.', 409, 'WATCH_CLAIM_CHANGED')
}

/** Validate the exact claim against the Site locked by the admission transaction. */
export function assertScheduledClaim(project: ScheduledClaimProject, claim: ScheduledRunClaim): void {
  const now = new Date()
  if (claim.scheduledAt > now || project.url !== claim.targetUrl ||
    project.watchInterval !== toStoredWatchInterval(claim.interval) || project.watchEveryMinutes !== claim.everyMinutes ||
    project.watchNextRunAt?.getTime() !== claim.scheduledAt.getTime() ||
    project.watchLastAttemptAt?.getTime() !== claim.attemptedAt.getTime() ||
    project.watchLeaseUntil?.getTime() !== claim.leaseUntil.getTime() || !(claim.leaseUntil > now))
    throw staleScheduledClaim()
}
