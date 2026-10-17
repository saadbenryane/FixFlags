import { z } from 'zod'
import { createHash } from 'node:crypto'
import type { TriageOutput } from './judge-triage-schema'
import type { TriageContext } from '../prompts/system-prompt'
import { TRIAGE_TEXT } from './page-text-limits'
import type { DeterministicFlag } from './flag-types'
import { baseCheckId } from './flag-identity'
import { canonicalizeDestination } from './url-identity'
import { TRIAGE_REVIEW_COPY } from '../marketing/copy/triage-review'

type Candidate = TriageOutput['newFlags'][number]
type Facts = Pick<TriageContext, 'pageText' | 'metadata'> & Partial<Pick<TriageContext, 'screenshotHint' | 'url'>>
export const triageAssessmentSchema = z.object({
  kind: z.literal('page-triage-assessment'), version: z.literal(1), status: z.enum(['COMPLETE', 'PARTIAL']),
  candidates: z.array(z.unknown()).max(5), rejected: z.array(z.object({ index: z.number().int().nonnegative(), reason: z.string() }).strict()).max(5),
  rubrics: z.array(z.unknown()).max(3).optional(), verdict: z.string().optional(),
  admittedCount: z.number().int().nonnegative(),
}).strict()
export type TriageAssessment = z.infer<typeof triageAssessmentSchema>

function rejection(candidate: Candidate, facts: Facts): string | undefined {
  const refs = candidate.evidenceRefs
  if (!candidate.reviewKind || !refs?.length || !candidate.device) return 'Missing declared review kind, source references, or device'
  const sources = { pageText: [facts.pageText.slice(0, TRIAGE_TEXT)], title: [facts.metadata.title ?? ''],
    description: [facts.metadata.description ?? ''], headline: facts.metadata.h1s, ctaText: facts.metadata.ctaTexts }
  if (refs.some(ref => !sources[ref.source].some(source => source.includes(ref.quote)))) return 'Reference does not occur in its declared captured source'
  if (refs.some(ref => ['headline', 'ctaText'].includes(ref.source) && !sources[ref.source].includes(ref.quote))) return 'Heading and action references must name a complete recorded value'
  if (refs.some(ref => ref.source === 'pageText' && ref.quote.length < 6)) return 'Prose reference is too short to establish its review scope'
  if (candidate.reviewKind === 'action-clarity' && !refs.some(ref => ref.source === 'ctaText')) return 'Action review has no recorded action reference'
  if (candidate.reviewKind === 'copy-clarity' && candidate.rubric !== 'MESSAGE') return 'Copy review belongs to the Message scope'
  if (candidate.reviewKind === 'copy-clarity' && !refs.some(ref => ['headline', 'pageText'].includes(ref.source))) return 'Copy review has no recorded headline or prose reference'
  if (candidate.reviewKind === 'search-snippet' && (candidate.rubric !== 'REACH' || !refs.some(ref => ['title', 'description'].includes(ref.source)))) return 'Search review has no corresponding metadata reference'
  if (candidate.reviewKind !== 'visual-hierarchy' && candidate.device !== 'none') return 'Text references cannot establish a device-specific observation'
  if (candidate.reviewKind === 'visual-hierarchy') {
    if (candidate.rubric !== 'EXPERIENCE' || new Set(refs.filter(ref => ref.source === 'ctaText' && facts.metadata.ctaTexts.includes(ref.quote)).map(ref => ref.quote)).size < 2) return 'Hierarchy review needs two distinct recorded actions'
    const imageAvailable = facts.screenshotHint === 'desktop-and-mobile' || facts.screenshotHint === `${candidate.device}-only`
    if (candidate.device === 'none' || !imageAvailable) return 'The declared screenshot device was not supplied'
  }
  return undefined
}

function normalizeReferences(refs: NonNullable<Candidate['evidenceRefs']>) {
  return [...new Map(refs.map(ref => [JSON.stringify([ref.source, ref.quote]), ref])).values()]
    .sort((a, b) => a.source.localeCompare(b.source) || a.quote.localeCompare(b.quote))
}

function groundedRecommendation(candidate: Candidate, refs: NonNullable<Candidate['evidenceRefs']>): Candidate {
  const copy = TRIAGE_REVIEW_COPY[candidate.reviewKind!]
  return { ...candidate, evidenceRefs: refs, problem: `${copy.problem}: "${refs[0]!.quote.slice(0, 100)}"`,
    evidence: refs.map(ref => `${TRIAGE_REVIEW_COPY.sources[ref.source]}: "${ref.quote}"`).join('\n') +
      (candidate.device === 'none' ? '' : `\nReview device: ${candidate.device}.`), whyItMatters: copy.why }
}

/** A quote names supporting evidence, not a new scalar metadata responsibility. */
function recordedScalarReviewIdentity(candidate: Candidate, facts: Facts): string | undefined {
  const refs = candidate.evidenceRefs ?? []
  const page = canonicalizeDestination(candidate.pageUrl ?? facts.url ?? '')?.key
  if (!page || candidate.reviewKind !== 'search-snippet' || !refs.length ||
    refs.some(ref => ref.source !== 'title' && ref.source !== 'description')) return undefined
  const sources = [...new Set(refs.map(ref => ref.source as 'title' | 'description'))].sort()
  const scope = { page, kind: candidate.reviewKind, device: candidate.device,
    values: sources.map(source => [source, facts.metadata[source] ?? null]) }
  return `ai-observation:v2::${createHash('sha256').update(JSON.stringify(scope)).digest('hex')}`
}

/** Quotes anchor a review scope. They cannot establish an unrelated failure or business outcome. */
export function assessTriageRecommendations(candidates: Candidate[], facts: Facts): { admitted: Candidate[]; assessment: TriageAssessment } {
  const rejected: TriageAssessment['rejected'] = []
  const admitted = candidates.flatMap((candidate, index) => {
    const reason = rejection(candidate, facts)
    if (reason) { rejected.push({ index, reason }); return [] }
    const grounded = groundedRecommendation(candidate, normalizeReferences(candidate.evidenceRefs!))
    const fingerprint = recordedScalarReviewIdentity(grounded, facts)
    return [{ ...grounded, ...(fingerprint ? { fingerprint } : {}) }]
  })
  return { admitted, assessment: { kind: 'page-triage-assessment', version: 1, status: rejected.length ? 'PARTIAL' : 'COMPLETE',
    candidates, rejected, admittedCount: admitted.length } }
}

/** Declared review scopes, never similar wording, determine redundant advisory actions. */
export function deduplicateTriageRecommendations(candidates: Candidate[], native: DeterministicFlag[], pageUrl?: string): Candidate[] {
  const grouped = new Map<string, Candidate>()
  for (const candidate of candidates) {
    const page = canonicalizeDestination(candidate.pageUrl ?? pageUrl ?? '')?.key
    const refs = candidate.evidenceRefs ?? []
    const covered = native.some(flag => {
      if (!page || canonicalizeDestination(flag.pageUrl ?? pageUrl ?? '')?.key !== page) return false
      const id = baseCheckId(flag.checkId)
      if (candidate.reviewKind === 'copy-clarity' && refs.some(ref => ref.source === 'headline'))
        return ['messaging-weak-value-prop', 'messaging-no-audience', 'messaging-headline-too-short', 'h1-generic'].includes(id ?? '') && refs.filter(ref => ref.source === 'headline').every(ref => flag.evidence.includes(ref.quote))
      if (candidate.reviewKind === 'action-clarity') return id === 'mobile-cta-weak-label' && refs.some(ref => ref.source === 'ctaText' && flag.evidence.includes(ref.quote))
      if (candidate.reviewKind === 'visual-hierarchy' && candidate.device === 'mobile')
        return ['hierarchy-competing-actions', 'competing-ctas'].includes(id ?? '') && refs.filter(ref => ref.source === 'ctaText').every(ref => flag.evidence.includes(ref.quote))
      if (candidate.reviewKind === 'search-snippet') return refs.some(ref =>
        ref.source === 'title' && ['title-too-short', 'title-too-long'].includes(id ?? '') ||
        ref.source === 'description' && ['description-too-short', 'description-too-long'].includes(id ?? ''))
      return false
    })
    if (covered) continue
    // Captured title and description are scalar fields. Quote fragments are evidence,
    // not distinct targets, when the declared review concerns only those scalar fields.
    const scalarMetadata = Boolean(page) && candidate.reviewKind === 'search-snippet' && refs.length > 0 &&
      refs.every(ref => ref.source === 'title' || ref.source === 'description')
    const targets = scalarMetadata ? [...new Set(refs.map(ref => ref.source))].sort() : refs
    const identity = JSON.stringify([page, candidate.reviewKind, candidate.device, targets])
    const prior = grouped.get(identity)
    if (!prior) { grouped.set(identity, candidate); continue }
    if (!scalarMetadata) continue
    const supportingReviews = [...new Map([
      ...(prior.supportingReviews ?? [{ evidence: prior.evidence }]),
      ...(candidate.supportingReviews ?? [{ evidence: candidate.evidence }]),
    ].map(review => [review.evidence, review])).values()].sort((a, b) => a.evidence.localeCompare(b.evidence))
    const combined = groundedRecommendation(prior, normalizeReferences([...(prior.evidenceRefs ?? []), ...refs]))
    grouped.set(identity, { ...combined, supportingReviews })
  }
  return [...grouped.values()]
}
