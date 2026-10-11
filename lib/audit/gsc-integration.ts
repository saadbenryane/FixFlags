import { prisma } from '@/lib/db'
import { runGoogleSearchForAudit } from './search/google'

/** Historical identity helper preserves exact URLs rather than joining unrelated pages. */
export function searchPageIdentity(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (!['https:', 'http:'].includes(url.protocol)) return null
    url.hash = ''
    return url.toString()
  } catch { return null }
}

/** Compatibility transports enter the same tenant/property-scoped Search workflow. */
export async function pullGscDataForAudit(auditId: string, userId: string, urls: string[]) {
  await runGoogleSearchForAudit({ auditId, userId, pages: urls.map(url => ({ url })), deadline: Date.now() + 30_000 })
}
export const pullSearchPerformanceForAudit = pullGscDataForAudit
export const pullIndexStatusForAudit = pullGscDataForAudit

export async function hasGscConnection(userId: string): Promise<boolean> {
  const count = await prisma.gscConnection.count({ where: { userId } })
  return count > 0
}
