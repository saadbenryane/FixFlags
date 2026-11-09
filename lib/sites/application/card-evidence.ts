import type { BoardCardView } from '@/lib/sites/board-card'
import { applySearchCardEvidence } from '@/lib/sites/search-view'
import { keyboardScopeComplete } from '@/lib/sites/coverage'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_BOARD_COPY, SITE_PRESENTATION_COPY } from '@/lib/marketing/copy/terminology'
import { recordedCheckSources } from '@/lib/sites/check-result-presentation'
import type { SiteCheckResult } from '@/lib/sites/check-result-contract'
import { readModuleCheckResult } from '@/lib/sites/check-results'
import type { Prisma } from '@prisma/client'
import { siteEvidenceAuditSelect } from './site-execution'
import type { connectionCardNotes } from '@/lib/sites/connections/read'
import type { RecordedPageEvidenceScope } from '@/lib/sites/page-coverage'

type EvidenceAudit = Pick<Prisma.AuditGetPayload<{ select: typeof siteEvidenceAuditSelect }>, 'id' | 'status' | 'startedAt' | 'verifierExecutions'>
export function applyCardEvidence({ cards, audit, summaryResults, inFlight, pageCount, connectionNotes, now, coverageMaxAgeMs, pendingAreas, pageScope }: {
  cards: BoardCardView[]; audit: EvidenceAudit | null; summaryResults: SiteCheckResult[]; inFlight: boolean; pageCount: number;
  connectionNotes: ReturnType<typeof connectionCardNotes>; now: Date; coverageMaxAgeMs?: number; pendingAreas?: ReadonlySet<BoardCardView['id']>
  pageScope?: RecordedPageEvidenceScope
}) {
  for (const card of cards) {
    card.sources = recordedCheckSources(summaryResults, card.id)
    if (card.id === 'site' && card.captureUrl && !card.sources.includes(SITE_BOARD_COPY.browserSource))
      card.sources.push(SITE_BOARD_COPY.browserSource)
    // Category activity needs an actual method receipt, not a blanket run flag.
    const moduleKey = ({ security: 'module:security', tracking: 'module:measurement', accessibility: 'module:accessibility' } as Record<string, string>)[card.id]
    const execution = audit?.verifierExecutions.find((item) => item.targetKey === moduleKey)
    const pending = pendingAreas?.has(card.id)
    card.activity = pending || card.id === 'site' && audit?.status === 'CAPTURING' ? 'checking' : null
    if (!card.evidenced && card.openFlagCount === 0 && inFlight) {
      const checked = execution?.status === 'COMPLETED' && !pending
      const incomplete = checked && audit && readModuleCheckResult(audit.id, execution).status === 'unknown'
      card.state = 'unknown'
      card.status = incomplete ? SITE_ACTION_COPY.execution.partialStatus : checked ? SITE_ACTION_COPY.execution.checkedStatus : SITE_ACTION_COPY.execution.waitingStatus
      card.answer = incomplete ? SITE_BOARD_COPY.cardCheckIncomplete : checked ? `${card.name} checks completed` : SITE_ACTION_COPY.execution.areaChecking(card.name)
      if (incomplete) card.incompleteReason ??= SITE_BOARD_COPY.cardCheckIncomplete
      card.detail = null
    }
    if (card.id === 'accessibility' && audit?.verifierExecutions.some(item => item.workKind === 'keyboard') &&
      !keyboardScopeComplete(audit.verifierExecutions, pageScope?.accessibility?.keyboard ? pageScope : undefined) &&
      !card.evidenced && card.openFlagCount === 0) {
      const copy = SITE_ACTION_COPY.execution.keyboard
      const keyboardPending = inFlight && audit.verifierExecutions.some(item => item.workKind === 'keyboard' && !['COMPLETED', 'FAILED', 'NOT_APPLICABLE'].includes(item.status))
      const keyboardReceipts = audit.verifierExecutions.filter(item => item.targetKey === 'module:keyboard')
        .map(item => ({ item, ...readModuleCheckResult(audit.id, item) })).filter(receipt => !receipt.scopeMismatch)
      const incomplete = keyboardReceipts.map(receipt => receipt.detail).find(receipt => 'complete' in receipt && receipt.complete === false)
      card.answer = keyboardPending ? copy.checking : copy.incomplete
      card.status = keyboardPending ? SITE_ACTION_COPY.execution.runningStatus : SITE_ACTION_COPY.execution.partialStatus
      card.detail = incomplete && 'limitation' in incomplete ? incomplete.limitation ?? copy.scope : keyboardPending ? copy.pending : copy.scope
      card.activity = keyboardPending || pending ? 'checking' : null
      if (!keyboardPending) {
        card.state = 'unknown'
        card.incompleteReason = SITE_BOARD_COPY.cardCheckIncomplete
        card.checkedAt = keyboardReceipts.find(({ item }) => item.status === 'COMPLETED')?.item.updatedAt.toISOString() ?? card.checkedAt
      }
    }
    if (inFlight && card.id === 'site') {
      card.state = 'unknown'; card.status = 'Pages'; card.answer = pageCount > 0 ? `${pageCount} pages recorded` : 'Waiting for pages'; card.detail = null
    }
    if (audit?.status === 'FAILED' && !audit.startedAt && !card.evidenced) {
      card.state = 'unknown'; card.answer = 'Not checked'; card.status = 'Not checked'; card.detail = 'The check did not start.'
    }
    applySearchCardEvidence(card, audit?.verifierExecutions ?? [], inFlight && (pending ?? true), now, coverageMaxAgeMs, pageScope)
    if (card.id !== 'site' && card.state === 'healthy' && card.openFlagCount === 0 && !card.incompleteReason && card.activity !== 'checking') {
      card.answer = SITE_PRESENTATION_COPY.flags(0)
      card.status = SITE_PRESENTATION_COPY.flags(0)
      card.detail = null
    }
    if (card.id === 'search' && connectionNotes.search) card.facts = [...card.facts, connectionNotes.search].slice(0, 4)
    if (card.id === 'tracking' && connectionNotes.tracking) card.facts = [...card.facts, connectionNotes.tracking].slice(0, 4)
    if (card.id === 'search' && connectionNotes.search) card.sources = [...new Set([...card.sources, SITE_BOARD_COPY.searchConsoleSource])]
    if (card.id === 'tracking' && connectionNotes.tracking) card.sources = [...new Set([...card.sources, SITE_BOARD_COPY.analyticsSource])]
  }
}
