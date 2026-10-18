import type { ReactElement, ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CompletedReportView } from '../CompletedReportView'
import ReportImage from '../opengraph-image'
import ShareImage from '@/app/share/[token]/opengraph-image'
import { savedFindingLabel } from '@/lib/report/finding-presentation'
import { computeRubricsFromRows } from '@/lib/audit/rubric'

const db = vi.hoisted(() => ({ audit: { findUnique: vi.fn() }, shareLink: { findUnique: vi.fn() } }))
vi.mock('@/lib/db', () => ({ prisma: db }))
vi.mock('next/og', () => ({ ImageResponse: class { constructor(public element: ReactElement) {} } }))
vi.mock('@/components/layout/audit-shell', () => ({ AuditShell: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/analytics/ReportViewedTracker', () => ({ ReportViewedTracker: () => null }))

const recommendation = { id: 'advice', checkId: 'journey-first-visit-destination-no-next-action', rubric: 'EXPERIENCE',
  severity: 'CRITICAL', confidence: 1, impactTag: 'CONVERSION', status: 'OPEN', problem: 'Review destination controls', evidence: 'Working navigation remains available.' }
const failure = { ...recommendation, id: 'failure', checkId: 'journey-first-visit-navigation-failed', severity: 'IMPORTANT', problem: 'Recorded destination returned an error', evidence: 'The opened destination returned HTTP 503.' }

describe('saved report finding presentation', () => {
  it('preserves both observations while distinguishing recommendations from consequential Flags', () => {
    const state = { id: 'saved', audit: { url: 'https://example.com/' }, flags: [recommendation, failure], isLoggedIn: false, session: null }
    render(<CompletedReportView state={state as unknown as Parameters<typeof CompletedReportView>[0]['state']} />)
    const adviceCard = screen.getByRole('heading', { name: recommendation.problem }).parentElement!.parentElement!
    expect(within(adviceCard as HTMLElement).getByText('Recommendation')).toBeInTheDocument()
    expect(screen.getByText('important Flag')).toBeInTheDocument()
    expect(screen.getByText(recommendation.evidence)).toBeInTheDocument()
  })
})

it.each(['report', 'share'] as const)('%s image chooses a consequential Flag after recommendations and retains diagnostic scoring', async surface => {
  const flags = [recommendation, { ...recommendation, id: 'advice2' }, { ...recommendation, id: 'advice3' }, failure]
  const rubrics = [{ name: 'EXPERIENCE', grade: 'C', score: 65, flags }]
  const audit = { url: 'https://example.com/', score: 65, verdict: 'Historical unsupported priority claim', status: 'COMPLETED', isPublic: true, userId: null, rubrics }
  db.audit.findUnique.mockResolvedValue(audit)
  db.shareLink.findUnique.mockResolvedValue({ revoked: false, passwordHash: null, expiresAt: null, maxViews: null, viewCount: 0, audit })
  const result = await (surface === 'report' ? ReportImage({ params: Promise.resolve({ id: 'saved' }) }) : ShareImage({ params: Promise.resolve({ token: 'shared' }) }))
  const props = (result as unknown as { element: ReactElement<{ topIssue: string; score: number; rubrics: unknown }> }).element.props
  expect(props.topIssue).toBe(failure.problem)
  expect(props.score).toBe(65)
  expect(props.rubrics).toEqual(computeRubricsFromRows(rubrics).map(({ name, status }) => ({ name, status })))
  const query = surface === 'report' ? db.audit.findUnique.mock.lastCall![0] : db.shareLink.findUnique.mock.lastCall![0].select.audit
  expect(query.select.rubrics.select.flags.select).toMatchObject({ checkId: true, rubric: true, confidence: true, impactTag: true, status: true, attentionPolicy: true, supportingObservations: true })
  expect(query.select.rubrics.select.flags.take).toBeUndefined()
})

it.each(['report', 'share'] as const)('%s image does not promote a historical verdict when only recommendations remain', async surface => {
  const audit = { url: 'https://example.com/', score: 65, verdict: 'Historical unsupported priority claim', status: 'COMPLETED', isPublic: true, userId: null,
    rubrics: [{ name: 'EXPERIENCE', grade: 'C', score: 65, flags: [recommendation] }] }
  db.audit.findUnique.mockResolvedValue(audit)
  db.shareLink.findUnique.mockResolvedValue({ revoked: false, passwordHash: null, expiresAt: null, maxViews: null, viewCount: 0, audit })
  const result = await (surface === 'report' ? ReportImage({ params: Promise.resolve({ id: 'saved' }) }) : ShareImage({ params: Promise.resolve({ token: 'shared' }) }))
  expect((result as unknown as { element: ReactElement<{ topIssue: string }> }).element.props.topIssue).toBe('Recorded website observations')
})

it.each([null, 'private-owner'])('keeps private report metadata generic before and after claim: %s', async userId => {
  db.audit.findUnique.mockResolvedValue({ url: 'https://private.example.com/', status: 'COMPLETED', isPublic: false, userId,
    score: 45, rubrics: [{ name: 'EXPERIENCE', grade: 'D', score: 45, flags: [failure] }] })
  const result = await ReportImage({ params: Promise.resolve({ id: 'private' }) })
  expect((result as unknown as { element: ReactElement<{ generic: boolean }> }).element.props.generic).toBe(true)
})

it.each([
  { revoked: true }, { passwordHash: 'protected' }, { expiresAt: new Date(0) },
  { maxViews: 2, viewCount: 2 }, { audit: { status: 'CAPTURING' } },
])('keeps inaccessible legacy share metadata generic: %o', async restriction => {
  db.shareLink.findUnique.mockResolvedValue({ revoked: false, passwordHash: null, expiresAt: null, maxViews: null, viewCount: 0,
    audit: { status: 'COMPLETED' }, ...restriction })
  const result = await ShareImage({ params: Promise.resolve({ token: 'inaccessible' }) })
  expect((result as unknown as { element: ReactElement<{ generic: boolean }> }).element.props.generic).toBe(true)
})

it('preserves explicit historical search observations and resolved records as observations', () => {
  expect(savedFindingLabel({ ...recommendation, checkId: 'noindex-meta' })).toBe('Observation')
  expect(savedFindingLabel({ ...failure, status: 'FIXED' })).toBe('Observation')
})

it.each(['report', 'share'] as const)('%s image honors a journey-critical Flag without reinterpreting its raw polish severity', async surface => {
  const confirmed = { ...failure, severity: 'POLISH', checkId: 'form-contact-failed', problem: 'Recorded contact submission failed' }
  const audit = { url: 'https://example.com/', score: 65, status: 'COMPLETED', isPublic: true, userId: null,
    rubrics: [{ name: 'EXPERIENCE', grade: 'C', score: 65, flags: [recommendation, confirmed] }] }
  db.audit.findUnique.mockResolvedValue(audit)
  db.shareLink.findUnique.mockResolvedValue({ revoked: false, passwordHash: null, expiresAt: null, maxViews: null, viewCount: 0, audit })
  const result = await (surface === 'report' ? ReportImage({ params: Promise.resolve({ id: 'saved' }) }) : ShareImage({ params: Promise.resolve({ token: 'shared' }) }))
  expect((result as unknown as { element: ReactElement<{ topIssue: string }> }).element.props.topIssue).toBe(confirmed.problem)
})
