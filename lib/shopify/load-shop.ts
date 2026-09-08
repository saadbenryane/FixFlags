import { prisma } from '@/lib/db'

const HISTORY_MS = 7 * 24 * 60 * 60 * 1000

export async function loadInstalledShop(shopDomain: string) {
  const since = new Date(Date.now() - HISTORY_MS)
  return prisma.shopifyShop.findFirst({
    where: { shopDomain, uninstalledAt: null },
    include: {
      paths: {
        orderBy: { createdAt: 'asc' },
        include: {
          runs: {
            where: { createdAt: { gte: since } },
            orderBy: { createdAt: 'desc' },
            take: 14,
          },
          improveItems: {
            orderBy: { createdAt: 'desc' },
            take: 8,
          },
        },
      },
      waitlist: { select: { featureKey: true } },
    },
  })
}

export async function countManualRechecksToday(pathIds: string[]): Promise<number> {
  if (pathIds.length === 0) return 0
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  return prisma.verificationRun.count({
    where: {
      pathId: { in: pathIds },
      trigger: 'manual',
      createdAt: { gte: start },
    },
  })
}
