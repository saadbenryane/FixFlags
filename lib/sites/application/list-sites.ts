import { prisma } from '@/lib/db'
import { loadSiteHome } from './queries'
import type { CardHealthState } from '@/lib/sites/card-areas'

export type SiteSummary = {
  id: string
  name: string
  hostname: string
  flagCount: number
  status: string
  state: CardHealthState
  coverage: string
  watch: string
  lastUsefulChangeAt: string
}

export async function loadSiteSummaries(userId: string): Promise<SiteSummary[]> {
  const projects = await prisma.project.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, canonicalHost: true, updatedAt: true },
  })
  const homes = await Promise.all(projects.map((project) => loadSiteHome(project.id)))
  return projects.flatMap((project, index) => {
    const home = homes[index]
    if (!home) return []
    return [{
      id: project.id,
      name: project.name,
      hostname: project.canonicalHost,
      flagCount: home.flags.length,
      status: home.statusLabel,
      state: home.statusState,
      coverage: home.coverageSummary,
      watch: home.watch.label,
      lastUsefulChangeAt: project.updatedAt.toISOString(),
    }]
  })
}
