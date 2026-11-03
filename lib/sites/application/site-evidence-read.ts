import { prisma } from '@/lib/db'
import type { SiteRecord } from '../types'
import { SiteRunRefusal } from './run-refusal'

export type SiteEvidenceScope = Pick<SiteRecord, 'kind' | 'projectId' | 'userId'>

/** Retain the admitted owner across multi-query evidence and private storage
 * reads. No database lock is held while reading external storage. Provisional
 * boards retain their original single-Audit possession scope. */
export async function readSiteEvidence<T>(site: SiteEvidenceScope, read: () => Promise<T>): Promise<T> {
  const assertOwner = async () => {
    if (!site.projectId && site.kind !== 'project') return
    if (!site.projectId || !site.userId || !await prisma.project.findFirst({
      where: { id: site.projectId, userId: site.userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
      select: { id: true },
    })) throw new SiteRunRefusal('Site not found', 404)
  }
  await assertOwner()
  const result = await read()
  await assertOwner()
  return result
}
