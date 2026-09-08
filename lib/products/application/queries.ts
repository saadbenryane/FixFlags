import { prisma } from '@/lib/db'
import {
  fromStoredWatchInterval,
  productWatchReadiness,
} from '@/lib/audit/project-watch'

export type ProductWatchQueryResult = {
  projectId: string
  url: string
  watchInterval: 'weekly' | 'daily' | null
  watchNextRunAt: Date | null
  watchLastRunAt: Date | null
  watchLastAttemptAt: Date | null
  watchConsecutiveFailures: number
  watchLastError: string | null
  readiness: ReturnType<typeof productWatchReadiness>
}

/** Owner-bounded Watch projection used by both GET and post-command reads. */
export async function loadProductWatch(
  projectId: string,
  userId: string
): Promise<ProductWatchQueryResult | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      id: true,
      url: true,
      watchInterval: true,
      watchNextRunAt: true,
      watchLastRunAt: true,
      watchLastAttemptAt: true,
      watchConsecutiveFailures: true,
      watchLastError: true,
    },
  })
  if (!project) return null

  return {
    projectId: project.id,
    url: project.url,
    watchInterval: fromStoredWatchInterval(project.watchInterval),
    watchNextRunAt: project.watchNextRunAt,
    watchLastRunAt: project.watchLastRunAt,
    watchLastAttemptAt: project.watchLastAttemptAt,
    watchConsecutiveFailures: project.watchConsecutiveFailures,
    watchLastError: project.watchLastError,
    readiness: productWatchReadiness(),
  }
}
