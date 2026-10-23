import type { BoardCardView } from '@/lib/sites/board-card'
import { applySearchCardEvidence } from '@/lib/sites/search-view'
import { keyboardScopeComplete } from '@/lib/sites/coverage'
import { readCheckReceipt } from '@/lib/audit/checks/receipt'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_BOARD_COPY, SITE_PRESENTATION_COPY } from '@/lib/marketing/copy/terminology'
import { siteCoverageIsStale } from '@/lib/sites/evidence-freshness'
import type { SiteCheckResult } from '@/lib/sites/check-results'
import type { Prisma } from '@prisma/client'
import { siteEvidenceAuditSelect } from './site-execution'
import type { loadSiteConnectionViews, connectionCardNotes } from '@/lib/sites/connections/read'

type EvidenceAudit = Prisma.AuditGetPayload<{ select: typeof siteEvidenceAuditSelect }>
export function applyCardEvidence({ cards, audit, summaryResults, inFlight, pageCount, connections, connectionNotes, now, coverageMaxAgeMs }: {
  cards: BoardCardView[]; audit: EvidenceAudit | null; summaryResults: SiteCheckResult[]; inFlight: boolean; pageCount: number;
  connections: Awaited<ReturnType<typeof loadSiteConnectionViews>> | null;
  connectionNotes: ReturnType<typeof connectionCardNotes>; now: Date; coverageMaxAgeMs?: number
}) {
  for (const card of cards) {
    if (card.state === 'healthy' && card.openFlagCount === 0) {
      const observation = summaryResults.find(result => result.area === card.id && !result.historical && result.kind === 'assertion' && result.status === 'passed')
      if (observation) {
        card.answer = observation.name
        card.detail = observation.observation ?? null
        card.checkedAt = observation.checkedAt
      }
    }
    // Category activity needs an actual method receipt, not a blanket run flag.
    const moduleKey = ({ security: 'module:security', tracking: 'module:measurement', accessibility: 'module:accessibility' } as Record<string, string>)[card.id]
    const execution = audit?.verifierExecutions.find((item) => item.targetKey === moduleKey)
    card.activity = card.id === 'site' && audit?.status === 'CAPTURING' ? 'checking' : null
    if (!card.evidenced && card.openFlagCount === 0 && inFlight) {
      card.state = 'unknown'
      card.status = execution?.status === 'COMPLETED' ? SITE_ACTION_COPY.execution.checkedStatus : SITE_ACTION_COPY.execution.waitingStatus
      card.answer = execution?.status === 'COMPLETED' ? `${card.name} checks completed` : SITE_ACTION_COPY.execution.areaChecking(card.name)
      card.detail = null
    }
    if (card.id === 'accessibility' && audit?.verifierExecutions.some(item => item.workKind === 'keyboard') && !keyboardScopeComplete(audit.verifierExecutions) &&
      !card.evidenced && card.openFlagCount === 0) {
      const copy = SITE_ACTION_COPY.execution.keyboard
      const keyboardPending = inFlight && audit.verifierExecutions.some(item => item.workKind === 'keyboard' && !['COMPLETED', 'FAILED', 'NOT_APPLICABLE'].includes(item.status))
      const incomplete = audit.verifierExecutions.filter(item => item.targetKey === 'module:keyboard')
        .map(item => readCheckReceipt(item.detail)).find(receipt => 'complete' in receipt && receipt.complete === false)
      card.answer = keyboardPending ? copy.checking : copy.incomplete
      card.status = keyboardPending ? SITE_ACTION_COPY.execution.runningStatus : SITE_ACTION_COPY.execution.partialStatus
      card.detail = incomplete && 'limitation' in incomplete ? incomplete.limitation ?? copy.scope : keyboardPending ? copy.pending : copy.scope
      card.activity = keyboardPending ? 'checking' : null
      if (!keyboardPending) {
        card.state = 'unknown'
        card.incompleteReason = SITE_BOARD_COPY.cardCheckIncomplete
        card.checkedAt = audit.verifierExecutions.find(item => item.targetKey === 'module:keyboard' && item.status === 'COMPLETED')?.updatedAt.toISOString() ?? card.checkedAt
      }
    }
    if (inFlight && card.id === 'site') {
      card.state = 'unknown'; card.status = 'Pages'; card.answer = pageCount > 0 ? `${pageCount} pages recorded` : 'Waiting for pages'; card.detail = null
    }
    if (audit?.status === 'FAILED' && !audit.startedAt && !card.evidenced) {
      card.state = 'unknown'; card.answer = 'Not checked'; card.status = 'Not checked'; card.detail = 'The check did not start.'
    }
    if (card.id === 'tracking' && card.openFlagCount === 0 && !inFlight && !card.incompleteReason && card.answer !== SITE_BOARD_COPY.checkOutOfDate) {
      const runtime = summaryResults.filter(result => result.area === 'tracking' && !result.historical && result.source === 'browser-network')
      if (runtime.length && !siteCoverageIsStale(card.checkedAt, now, coverageMaxAgeMs)) {
        const copy = SITE_ACTION_COPY.execution.tracking
        const attempts = runtime.find(result => result.assertionKey === 'tracking-initiation' && result.status === 'observed')
        const library = runtime.find(result => result.assertionKey === 'tracking-library' && result.status === 'passed')
        // A finished check with no Flag is a clear result. Delivery stays in the category evidence.
        card.facts = [...card.facts, copy.deliveryLimit, copy.consentLimit].slice(-4)
        if (attempts || library) {
          card.state = 'healthy'
          card.evidenced = true
          card.detail = null
        } else {
          card.state = 'unknown'
          card.answer = copy.runtimeUnknown
          card.status = copy.runtimeUnknown
          card.detail = null
        }
      }
    }
    applySearchCardEvidence(card, audit?.verifierExecutions ?? [], inFlight, now, coverageMaxAgeMs)
    if (card.id !== 'site' && card.state === 'healthy' && card.openFlagCount === 0 && !card.incompleteReason && card.activity !== 'checking') {
      card.answer = SITE_PRESENTATION_COPY.flags(0)
      card.status = SITE_PRESENTATION_COPY.flags(0)
      card.detail = null
    }
    if (card.id === 'search' && connectionNotes.search) card.facts = [...card.facts, connectionNotes.search].slice(0, 4)
    if (card.id === 'tracking' && connectionNotes.tracking) card.facts = [...card.facts, connectionNotes.tracking].slice(0, 4)
    if (card.id === 'search' && connections?.searchConsole.status === 'connected') card.sources = [...card.sources, 'Search Console']
    if (card.id === 'tracking' && connections?.analytics.status === 'connected') card.sources = [...card.sources, 'Google Analytics']
  }
}
