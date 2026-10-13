import type { Project, User } from '@prisma/client'
import { allowedWatchIntervals } from '@/lib/auth/entitlements'
import { fromStoredWatchInterval } from '@/lib/audit/watch-interval'

export type MonitoringProject = Pick<Project, 'id' | 'url' | 'deletedAt' | 'watchInterval' | 'watchNextRunAt'> & {
  user: Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'> & Partial<Pick<User,'lifecycleStatus'>>
}

export function uptimeEligible(project: MonitoringProject) {
  const interval = fromStoredWatchInterval(project.watchInterval)
  return (!project.user.lifecycleStatus || project.user.lifecycleStatus === 'ACTIVE') && !project.deletedAt && Boolean(project.watchNextRunAt) && interval !== null && allowedWatchIntervals(project.user).includes(interval)
}
