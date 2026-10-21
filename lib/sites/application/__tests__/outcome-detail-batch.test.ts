import { beforeEach, expect, it, vi } from 'vitest'
import type { SiteRecord } from '@/lib/sites/types'
const db = vi.hoisted(() => ({ outcomes: vi.fn(), fixtures: vi.fn(), references: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { siteOutcome: { findMany: db.outcomes }, outcomeFixture: { findMany: db.fixtures } } }))
vi.mock('@/lib/sites/application/outcome-references', () => ({ loadOutcomeDetailReferences: db.references }))
import { loadSiteOutcomeDetail, loadSiteOutcomeDetails } from '../outcome-queries'

const site = { kind: 'project', projectId: 'site' } as SiteRecord
const row = { id: 'outcome', projectId: 'site', provisionalSiteId: null, name: 'Page loads', slug: 'page-loads', description: null,
  inferenceSource: 'browser', confirmedAt: null, pages: [], kind: 'AVAILABILITY', criticality: 'IMPORTANT', environment: 'production',
  enabled: true, staleAfterMinutes: 60, expectation: null, bindings: [], assessments: [], runSelections: [], bindingAttempts: [], bindingExecutions: [], improvements: [] }
beforeEach(() => { vi.clearAllMocks(); db.fixtures.mockResolvedValue([]) })

it('reads 24 Outcome details through two batches, without per-Outcome reloads', async () => {
  const rows = Array.from({ length: 24 }, (_, index) => ({ ...row, id: 'outcome-' + index }))
  db.references.mockResolvedValue(rows.map(row => ({ id: row.id, assessmentIds: [], successfulAssessmentId: null,
    runRequestIds: [], bindingAttemptIds: [], executionIds: [], improvementIds: [], occurrenceIds: [], improvementAttemptIds: [] })))
  db.outcomes.mockResolvedValue(rows)
  const details = await loadSiteOutcomeDetails(site, { excludeGeneric: true })
  expect(details.map(item => item.id)).toEqual(rows.map(item => item.id))
  expect(db.references).toHaveBeenCalledTimes(1)
  expect(db.references).toHaveBeenCalledWith(site, { excludeGeneric: true })
  expect(db.outcomes).toHaveBeenCalledTimes(1)
  expect(db.outcomes.mock.calls[0][0].include.bindingExecutions.where).toEqual({ id: { in: [] } })
  expect(db.outcomes.mock.calls[0][0].include.runSelections.select.runRequest.select).not.toHaveProperty('executionSpec')
  expect(db.outcomes.mock.calls[0][0].where).toEqual({ projectId: 'site', id: { in: rows.map(item => item.id) } })
})

it('does not query another authority after an empty or inaccessible Outcome selection', async () => {
  db.references.mockResolvedValue([])
  expect(await loadSiteOutcomeDetail(site, 'missing')).toBeNull()
  expect(db.outcomes).not.toHaveBeenCalled()
  expect(db.references).toHaveBeenCalledWith(site, { outcomeId: 'missing' })
  expect(db.fixtures).not.toHaveBeenCalled()
})
