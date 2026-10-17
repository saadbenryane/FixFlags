import { assessTriageRecommendations } from '@/lib/audit/triage-grounding'
import { admitAiObservation } from '@/lib/audit/ai-observation-identity'
import { buildTriageAiFlagRow } from '@/lib/audit/persist'
import { describe, expect, it, vi } from 'vitest'
import { isCustomerFlag } from '@/lib/audit/attention'
import { loadSiteFlags, loadSiteRecommendations } from '../flags'
import type { SiteRecord } from '../types'

const prisma = vi.hoisted(() => ({
  flag: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: { flag: prisma.flag, improvement: { findMany: vi.fn().mockResolvedValue([]) }, audit: { findFirst: vi.fn() } } }))

const site = { kind: 'provisional', primaryAuditId: 'audit-1' } as SiteRecord

describe('customer Flag projector on Site load', () => {
  it('shows one current scalar review across audits without rewriting either original observation', async () => {
    const facts = { url: 'https://example.com/', pageText: 'Release planning for teams.',
      metadata: { title: 'Plan releases together. Coordinate your team.', description: '', h1s: [], ctaTexts: [], hasStructuredData: false } }
    const rows = ['Plan releases together.', 'Coordinate your team.'].map((quote, index) => {
      const review = assessTriageRecommendations([{ reviewKind: 'search-snippet', rubric: 'REACH', device: 'none',
        impactTag: 'SEO', severity: 'POLISH', confidence: 0.5, problem: 'Review title', evidence: quote,
        whyItMatters: 'Check the wording against the page purpose.', pageUrl: facts.url, evidenceRefs: [{ source: 'title', quote }] }], facts).admitted[0]!
      return { ...buildTriageAiFlagRow(admitAiObservation(review, { auditId: 'audit-' + index, taskId: 'judge-' + index,
        collectedAt: '2026-10-17T07:00:00.000Z' }), 0, new Map(), new Map(), 0), id: 'review-' + index,
        auditId: 'audit-' + index, status: 'OPEN', resolvedInId: null }
    }).reverse()
    const recorded = structuredClone(rows)
    prisma.flag.findMany.mockResolvedValue(rows)
    const owned = { kind: 'project', projectId: 'owned-site', primaryAuditId: 'audit-1' } as SiteRecord
    expect((await loadSiteRecommendations(owned)).map(flag => flag.id)).toEqual(['review-1'])
    expect(rows).toEqual(recorded)
    expect(rows[0]!.fingerprint).toBe(rows[1]!.fingerprint)
    expect(rows[0]!.evidence).not.toBe(rows[1]!.evidence)
    expect(JSON.stringify(rows[0]!.supportingObservations)).toContain('judge-1')
    expect(JSON.stringify(rows[1]!.supportingObservations)).toContain('judge-0')
  })

  it('retains an unresolved claimed finding after a later partial check and scopes the query to its Site', async () => {
    prisma.flag.findMany.mockResolvedValue([{ id: 'claimed-contact', fingerprint: 'contact-failure', auditId: 'claimed-analysis',
      checkId: 'form-contact-submit-failed', rubric: 'EXPERIENCE', severity: 'IMPORTANT', impactTag: 'CONVERSION',
      problem: 'Contact form does not send', evidence: 'Submit returned 500', whyItMatters: 'Visitors cannot reach you',
      fix: 'Fix the form endpoint', pageUrl: 'https://example.com/contact', status: 'OPEN' }])
    const owned = { kind: 'project', projectId: 'owned-site', primaryAuditId: 'later-partial-check' } as SiteRecord
    expect((await loadSiteFlags(owned)).map(flag => flag.id)).toEqual(['claimed-contact'])
    expect(prisma.flag.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({
      audit: expect.objectContaining({ projectId: 'owned-site' }), improvementOccurrence: null,
    }) }))
  })

  it('keeps broken contact as a Flag and optional SEO meta as a Recommendation', async () => {
    prisma.flag.findMany.mockResolvedValue([
      {
        id: 'flag-contact',
        checkId: 'form-contact-submit-failed',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        impactTag: 'CONVERSION',
        problem: 'Contact form does not send',
        evidence: 'Submit returned 500',
        whyItMatters: 'Visitors cannot reach you',
        fix: 'Fix the form endpoint',
        pageUrl: 'https://example.com/contact',
        status: 'OPEN',
      },
      {
        id: 'flag-title',
        checkId: 'title-too-long',
        rubric: 'REACH',
        severity: 'IMPORTANT',
        impactTag: 'SEO',
        problem: 'Title tag is too long',
        evidence: 'title length 80',
        whyItMatters: 'Snippets may truncate',
        fix: 'Shorten the title',
        pageUrl: 'https://example.com/about',
        status: 'OPEN',
      },
    ])

    expect(isCustomerFlag({ checkId: 'form-contact-submit-failed', impactTag: 'CONVERSION', severity: 'IMPORTANT' })).toBe(true)
    expect(isCustomerFlag({ checkId: 'title-too-long', impactTag: 'SEO', severity: 'IMPORTANT' })).toBe(false)

    const flags = await loadSiteFlags(site)
    const recommendations = await loadSiteRecommendations(site)
    expect(flags.map((flag) => flag.id)).toEqual(['flag-contact'])
    expect(recommendations.map((flag) => flag.id)).toEqual(['flag-title'])
  })

  it('retains a missing-recognizer Recommendation while suppressing an unsupported stored slow-action Flag', async () => {
    prisma.flag.findMany.mockResolvedValue([
      {
        id: 'flag-missing',
        checkId: 'journey-first-visit-hidden-cta',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        impactTag: 'CONVERSION',
        problem: 'No obvious primary CTA on first visit',
        evidence: 'No primary action stands out.',
        whyItMatters: 'People have nothing clear to do next.',
        fix: 'Add one primary action.',
        pageUrl: 'https://example.org/',
        status: 'OPEN',
      },
      {
        id: 'flag-slow',
        checkId: 'slow-3g-cta-delayed',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        impactTag: 'CONVERSION',
        problem: 'Primary CTA is not visible within 8 seconds on slow 3G',
        evidence: 'The primary CTA was not detected.',
        whyItMatters: 'People leave before they can act.',
        fix: 'Render the action in the first HTML.',
        pageUrl: 'https://example.org/',
        status: 'OPEN',
      },
    ])

    const flags = await loadSiteFlags(site)
    expect(flags).toEqual([])
    const recommendations = await loadSiteRecommendations(site)
    expect(recommendations.map(flag => flag.checkId)).toEqual(['journey-first-visit-hidden-cta'])
    expect(recommendations[0]?.severity).toBe('CRITICAL')
    expect(recommendations.map(flag => flag.checkId)).not.toContain('slow-3g-cta-delayed')
  })

  it('keeps a slow-action Flag when a primary action was found', async () => {
    prisma.flag.findMany.mockResolvedValue([
      {
        id: 'flag-slow',
        checkId: 'slow-3g-cta-delayed',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        impactTag: 'CONVERSION',
        problem: 'Primary CTA is not visible within 8 seconds on slow 3G',
        evidence: 'The primary CTA became visible after 9000ms.',
        whyItMatters: 'People leave before they can act.',
        fix: 'Render the action in the first HTML.',
        pageUrl: 'https://example.org/',
        status: 'OPEN',
      },
    ])

    const flags = await loadSiteFlags(site)
    expect(flags.map((flag) => flag.id)).toEqual(['flag-slow'])
  })
})
