import { beforeEach, expect, it, vi } from 'vitest'
import type { SiteRecord } from '@/lib/sites/types'
const db = vi.hoisted(() => ({ outcomes: vi.fn(), pages: vi.fn(), fixtures: vi.fn(), references: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { siteOutcome: { findMany: db.outcomes }, sitePage: { findMany: db.pages }, outcomeFixture: { findMany: db.fixtures } } }))
vi.mock('@/lib/sites/application/outcome-references', () => ({ loadOutcomeSummaryReferences: db.references }))
import { listSiteOutcomes, toOutcomeView } from '../outcome-queries'

const now = new Date('2026-10-20T12:00:00Z')
const page = (id: string, projectId: string | null = 'site', provisionalSiteId: string | null = null) => ({ pageId: id,
  page: { url: `https://example.com/${id}`, projectId, provisionalSiteId } })
const row = { id: 'outcome', projectId: 'site' as string | null, provisionalSiteId: null as string | null, name: 'Page loads', slug: 'page-loads', description: null,
  inferenceSource: 'browser', confirmedAt: now, pages: [page('two'), page('one')], kind: 'AVAILABILITY' as const,
  criticality: 'IMPORTANT' as const, environment: 'production', enabled: true, staleAfterMinutes: 60, expectation: null,
  bindings: [], assessments: [], runSelections: [] }
beforeEach(() => {
  vi.clearAllMocks(); db.fixtures.mockResolvedValue([])
  db.pages.mockResolvedValue(['one', 'two', 'private'].map(id => ({ id, url: `https://example.com/${id}` })))
})

it('projects 24 watched Outcomes without a page query for each row and preserves supplied page order', async () => {
  const rows = Array.from({ length: 24 }, (_, index) => ({ ...row, id: 'outcome-' + index }))
  db.outcomes.mockResolvedValue(rows)
  db.references.mockResolvedValue(rows.map(row => ({ id: row.id, assessmentIds: [], runRequestIds: [] })))
  const views = await listSiteOutcomes({ kind: 'project', projectId: 'site' } as SiteRecord, now)
  expect(views).toHaveLength(24)
  expect(views.every(view => JSON.stringify(view.pageUrls) === JSON.stringify(['https://example.com/two', 'https://example.com/one']))).toBe(true)
  expect(db.pages).not.toHaveBeenCalled()
  expect(db.outcomes).toHaveBeenCalledTimes(1)
  expect(db.outcomes.mock.calls[0][0].where).toEqual({ projectId: 'site', id: { in: rows.map(row => row.id) } })
})

it('does not emit another Site page from an inconsistent association', async () => {
  const view = await toOutcomeView({ ...row, pages: [page('private', 'another-site'), page('one')] }, [], now)
  expect(view.pageIds).toEqual(['one'])
  expect(view.pageUrls).toEqual(['https://example.com/one'])
  expect(db.pages).not.toHaveBeenCalled()
})

it('retains unclaimed page identity but cannot borrow a page after its ownership transfers', async () => {
  const source = { ...row, projectId: null, provisionalSiteId: 'provisional', pages: [page('one', null, 'provisional'),
    page('private', 'claimed-project', 'provisional'), page('two', null, 'another-provisional')] }
  const view = await toOutcomeView(source, [], now)
  expect(view.pageIds).toEqual(['one'])
  expect(view.pageUrls).toEqual(['https://example.com/one'])
})
