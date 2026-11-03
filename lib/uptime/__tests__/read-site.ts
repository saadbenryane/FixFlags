import type { SiteEvidenceScope } from '@/lib/sites/application/site-evidence-read'

/** The fixture's admitted owner, retained independently of later database changes. */
export function uptimeReadSite(project: { id: string; userId: string }): SiteEvidenceScope {
  return { kind: 'project', projectId: project.id, userId: project.userId }
}
