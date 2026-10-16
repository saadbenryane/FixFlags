import type { Project, User } from '@prisma/client'
import { fromStoredWatchInterval } from '@/lib/audit/watch-interval'

export type MonitoringProject = Pick<Project, 'id' | 'url' | 'deletedAt' | 'watchInterval' | 'watchNextRunAt'> & {
  user: Pick<User, 'id' | 'lifecycleStatus'>
}

/** Basic reachability is included separately on every plan. Analysis cadence,
 * allowances and grants cannot revoke an active Site's uptime monitoring. */
export const uptimeProjectInclude = {
  user: { select: { id: true, email: true, lifecycleStatus: true } },
} as const

export function uptimeEligible(project: MonitoringProject) {
  return project.user.lifecycleStatus === 'ACTIVE' && !project.deletedAt && fromStoredWatchInterval(project.watchInterval) !== null
}
