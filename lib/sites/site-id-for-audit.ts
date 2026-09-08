import { prisma } from '@/lib/db'
import { encodeSiteId } from '@/lib/sites/types'

export function siteBoardPath(siteId: string): string {
  return `/sites/${encodeURIComponent(siteId)}`
}

export function siteBoardUrl(siteId: string, origin?: string): string {
  const appUrl = (origin ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://fixflags.com').replace(
    /\/$/,
    ''
  )
  return `${appUrl}${siteBoardPath(siteId)}`
}

/** Customer Site id for an analysis. Provisional Sites stay `p_*`, never projectId. */
export async function customerSiteIdForAudit(audit: {
  id: string
  projectId: string | null
}): Promise<string> {
  if (audit.projectId) {
    return encodeSiteId({ kind: 'project', projectId: audit.projectId })
  }
  const provisional = await prisma.provisionalSite.findFirst({
    where: { primaryAuditId: audit.id },
    select: { id: true },
  })
  if (provisional) {
    return encodeSiteId({ kind: 'provisional', provisionalSiteId: provisional.id })
  }
  return audit.id
}

export async function customerSiteFieldsForAudit(audit: {
  id: string
  projectId: string | null
}): Promise<{ siteId: string; siteUrl: string }> {
  const siteId = await customerSiteIdForAudit(audit)
  return { siteId, siteUrl: siteBoardUrl(siteId) }
}
