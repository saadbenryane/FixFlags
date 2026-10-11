import type { BoardCardView } from '@/lib/sites/board-card'
import { incompleteCardReason } from '@/lib/sites/board-card'
import { applySearchCardEvidence } from '@/lib/sites/search-view'
import { keyboardScopeComplete } from '@/lib/sites/coverage'
import { readCheckReceipt } from '@/lib/audit/checks/receipt'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import type { SiteCheckResult } from '@/lib/sites/check-results'
import type { Prisma } from '@prisma/client'
import { siteEvidenceAuditSelect } from './site-execution'
import type { loadSiteConnectionViews, connectionCardNotes } from '@/lib/sites/connections/read'

type EvidenceAudit = Prisma.AuditGetPayload<{ select: typeof siteEvidenceAuditSelect }>
export function applyCardEvidence({ cards, audit, summaryResults, inFlight, pageCount, connections, connectionNotes, now }: {
  cards: BoardCardView[]; audit: EvidenceAudit | null; summaryResults: SiteCheckResult[]; inFlight: boolean; pageCount: number;
  connections: Awaited<ReturnType<typeof loadSiteConnectionViews>> | null;
  connectionNotes: ReturnType<typeof connectionCardNotes>; now: Date
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
      card.status = execution?.status === 'COMPLETED' ? 'Evidence recorded' : 'Waiting'
      card.answer = execution?.status === 'COMPLETED' ? `${card.name} checks completed` : `Waiting for ${card.name.toLowerCase()} evidence`
      card.detail = null
    }
    if (card.id === 'accessibility' && audit?.verifierExecutions.some(item => item.workKind === 'keyboard') && !keyboardScopeComplete(audit.verifierExecutions) &&
      !card.evidenced && card.openFlagCount === 0) {
      const copy = SITE_ACTION_COPY.execution.keyboard
      const incomplete = audit.verifierExecutions.filter(item => item.targetKey === 'module:keyboard')
        .map(item => readCheckReceipt(item.detail)).find(receipt => 'complete' in receipt && receipt.complete === false)
      card.answer = inFlight ? copy.checking : copy.incomplete
      card.status = inFlight ? SITE_ACTION_COPY.execution.states.RUNNING : copy.incomplete
      card.detail = incomplete && 'limitation' in incomplete ? incomplete.limitation ?? copy.scope : inFlight ? copy.pending : copy.scope
      card.activity = inFlight ? 'checking' : null
    }
    if (inFlight && card.id === 'site') {
      card.state = 'unknown'; card.status = 'Pages'; card.answer = pageCount > 0 ? `${pageCount} pages recorded` : 'Waiting for pages'; card.detail = null
    }
    if (audit?.status === 'FAILED' && !audit.startedAt && !card.evidenced) {
      card.answer = 'Not checked'; card.status = 'Not checked'; card.detail = 'The check did not start.'
    }
    if (card.id === 'tracking' && card.openFlagCount === 0) {
      const runtime = summaryResults.filter(result => result.area === 'tracking' && !result.historical && result.source === 'browser-network')
      if (runtime.length) {
        const copy = SITE_ACTION_COPY.execution.tracking
        const attempts = runtime.find(result => result.assertionKey === 'tracking-initiation' && result.status === 'observed')
        const library = runtime.find(result => result.assertionKey === 'tracking-library' && result.status === 'passed')
        card.state = 'unknown'; card.evidenced = false; card.status = copy.partial
        card.answer = attempts ? copy.requestsObserved : library ? copy.libraryObserved : copy.runtimeUnknown
        card.detail = attempts?.observation ?? library?.observation ?? runtime.find(result => result.status === 'unknown')?.observation ?? copy.deliveryLimit
        card.facts = [...card.facts, copy.deliveryLimit, copy.consentLimit].slice(-4)
        card.activity = null
      }
    }
    applySearchCardEvidence(card, audit?.verifierExecutions ?? [], inFlight, now)
    if (card.id === 'search' && connectionNotes.search) card.facts = [...card.facts, connectionNotes.search].slice(0, 4)
    if (card.id === 'tracking' && connectionNotes.tracking) card.facts = [...card.facts, connectionNotes.tracking].slice(0, 4)
    if (card.id === 'search' && connections?.searchConsole.status === 'connected') card.sources = [...card.sources, 'Search Console']
    if (card.id === 'tracking' && connections?.analytics.status === 'connected') card.sources = [...card.sources, 'Google Analytics']
    card.incompleteReason = incompleteCardReason({
      card,
      auditStatus: audit?.status ?? null,
      failureCode: audit?.failureCode ?? null,
      failedModules: Array.isArray(audit?.failedModules) ? audit.failedModules.filter((item): item is string => typeof item === 'string') : [],
      triageCompleted: Boolean(audit?.triageAt),
      extraReviewCompleted: Boolean(audit?.aiReviewAt),
    })
    if (card.incompleteReason && card.state === 'healthy') card.state = 'unknown'
  }
}
