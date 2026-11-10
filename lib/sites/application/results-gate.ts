import { prisma } from '@/lib/db'
import type { SiteRecord } from '@/lib/sites/types'

/** Where the check is, without any of what it found. */
export type SiteResultsGateState = 'running' | 'ready' | 'failed'
export type SiteResultsGateStage = 0 | 1 | 2 | 3

export type SiteResultsGateView = {
  kind: 'results_gate'
  siteId: string
  host: string
  state: SiteResultsGateState
  stage: SiteResultsGateStage
  /** sign_in for a visitor without an account, claim for a signed-in visitor. */
  continuation: 'sign_in' | 'claim'
}

const STAGE_BY_STATUS: Record<string, SiteResultsGateStage> = {
  QUEUED: 0, CAPTURING: 0, CHECKING: 1, JUDGING: 2, FINALIZING: 3, COMPLETED: 3, FAILED: 3,
}

export function siteResultsGateState(status: string | null | undefined): SiteResultsGateState {
  if (status === 'COMPLETED') return 'ready'
  if (status === 'FAILED') return 'failed'
  return 'running'
}

/**
 * The only Site projection a non-owner receives. Results, Flags, evidence,
 * captures, pages and activity stay behind sign-in; the claim after signup
 * moves the same check into the new account.
 */
export async function loadSiteResultsGate(site: SiteRecord, authenticated: boolean): Promise<SiteResultsGateView> {
  const audit = site.primaryAuditId
    ? await prisma.audit.findUnique({ where: { id: site.primaryAuditId }, select: { status: true } })
    : null
  const status = audit?.status ?? null
  return {
    kind: 'results_gate',
    siteId: site.siteId,
    host: site.canonicalHost.replace(/^www\./, ''),
    state: siteResultsGateState(status),
    stage: status ? STAGE_BY_STATUS[status] ?? 0 : 0,
    continuation: authenticated ? 'claim' : 'sign_in',
  }
}
