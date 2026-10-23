import { describe, expect, it } from 'vitest'
import { applyCardEvidence } from '../card-evidence'
import type { BoardCardView } from '@/lib/sites/board-card'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

const pageUrl = 'https://example.com/'
const now = new Date('2026-10-23T12:00:00Z')
const keyboardReceipt = { kind: 'site-module-check', version: 1, module: 'keyboard', pageUrl,
  applicable: true, passed: false, complete: false, assertions: [], limitation: 'The keyboard inspection reached its control limit.' }
function project(status: string, kind: 'accessibility' | 'tracking' = 'accessibility') {
  const card: BoardCardView = { id: kind, name: kind === 'accessibility' ? 'Accessibility' : 'Tracking', state: 'unknown',
    status: 'Waiting', question: '', answer: '', detail: null, evidenced: false, openFlagCount: 0, checkedAt: null,
    flagIds: [], flagChips: [], facts: [], coverage: null, sources: [], activity: null, wide: false,
    captureUrl: null, captureAlt: null, cropUrl: null, cropAlt: null, problem: null }
  const audit = { status: 'CHECKING', verifierExecutions: kind === 'accessibility' ? [
    { targetKey: 'task:p0:keyboard-evidence', workKind: 'keyboard', status, pageUrl, updatedAt: now, detail: null },
    ...(status === 'COMPLETED' ? [{ targetKey: 'module:keyboard', status: 'COMPLETED', pageUrl, updatedAt: now, detail: keyboardReceipt }] : []),
  ] : [{ targetKey: 'module:measurement', status: 'COMPLETED', updatedAt: now, detail: null }] }
  applyCardEvidence({ cards: [card], audit: audit as unknown as Parameters<typeof applyCardEvidence>[0]['audit'],
    summaryResults: [], inFlight: true, pageCount: 1, connections: null, connectionNotes: { search: null, tracking: null }, now })
  return card
}
describe('category evidence during a running scan', () => {
  it('stops the keyboard loading state as soon as its own task settles', () => {
    expect(project('RUNNING')).toMatchObject({ activity: 'checking', status: 'Running' })
    const settled = project('COMPLETED')
    expect(settled).toMatchObject({ activity: null, state: 'unknown', status: 'Partially checked', checkedAt: now.toISOString() })
    expect(settled.incompleteReason).toBeTruthy()
    expect(settled.detail).toBe(keyboardReceipt.limitation)
  })
  it('does not call a recorded tracking task healthy while unrelated work is running', () => {
    expect(project('COMPLETED', 'tracking')).toMatchObject({ activity: null, state: 'unknown', status: SITE_ACTION_COPY.execution.checkedStatus })
  })
})
