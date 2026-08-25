import sampleBundleJson from '@/lib/marketing/sample-evidence-anchors.json'
import { computeRubricScores } from '@/lib/audit/checks/rubric-scoring'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { computeShareStatusFromRubrics, computeRubricsFromRows } from '@/lib/audit/rubric'
import { calculateOverallScore, gradeFromScore, statusFromScore } from '@/lib/audit/scoring'
import type { DeterministicFlag } from '@/lib/audit/flag-types'
import type { ReportRubricRow } from '@/lib/audit/build-report-shape'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import type { CuratedSampleAudit } from '@/lib/marketing/curated-sample'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
import { originalFixture } from '@/lib/demo/fixtures/original'
import { DEMO_BRAND } from '@/lib/demo/brand'

const SAMPLE_URL = DEMO_BRAND.sampleUrl

export const LATEST_STATIC_SAMPLE_OBSERVATION_ID = 'curated-sample-v1'

type SampleRubricScores = Record<'MESSAGE' | 'EXPERIENCE' | 'REACH', number>

type StaticObservationDefinition = {
  id: string
  revision: string
  sourcePath: '/demo' | '/demo?baseline=1' | '/demo/v1'
  completedAt: string
  parentId: string | null
  kind: 'product-review' | 'update-review'
  verdict: string
  flags: readonly RankableFlag[]
}

export type StaticSampleCaptureDefinition = Pick<
  StaticObservationDefinition,
  'id' | 'revision' | 'sourcePath' | 'completedAt'
> & {
  score: number
  flagIds: string[]
  timeline: string[]
  anchorTargets: Array<{ checkId: string; problem: string; evidence: string }>
}

type SampleCaptureManifestEntry = {
  revision: string
  sourcePath: string
  reviewedAt: string
  documentSha256: string
  score: number
  flagIds: string[]
  timeline: string[]
  captures: {
    desktop: { path: string; sha256: string; width: number; height: number }
    mobile: { path: string; sha256: string; width: number; height: number }
  }
  anchors: EvidenceAnchorMap
}

type SampleCaptureManifest = {
  schemaVersion: number
  generatedBy: string
  observations: Record<string, SampleCaptureManifestEntry>
}

const ORIGINAL_FLAGS: readonly RankableFlag[] = [
  {
    id: 'flag-experience-mobile-cta',
    checkId: 'cta-below-fold-mobile',
    rubric: 'EXPERIENCE',
    severity: 'CRITICAL',
    impactTag: 'CONVERSION',
    problem: 'Primary CTA is hidden below the fold on mobile',
    evidence: 'On mobile (375×812), the primary CTA starts below the first screen and requires scrolling.',
    whyItMatters: 'People can miss the main next step, which can reduce conversions.',
    fix: 'Reduce the mobile hero height and place the primary CTA in the first viewport.',
    agentPrompt: 'At 375px, reduce the hero media height and keep the primary CTA visible within the first 812px.',
    verificationRule: 'At 375×812, the primary CTA is visible without scrolling.',
    pageUrl: null,
  },
  {
    id: 'flag-message-headline',
    checkId: 'h1-generic',
    rubric: 'MESSAGE',
    severity: 'IMPORTANT',
    impactTag: 'CLARITY',
    problem: 'Hero headline describes the category instead of the outcome',
    evidence: `The H1 reads “${originalFixture.headline},” but does not name the outcome a customer gets.`,
    whyItMatters: 'Visitors have to infer why the product is useful.',
    fix: 'Name the audience and the concrete release outcome in the H1.',
    agentPrompt: 'Replace the H1 with a concise audience-and-outcome statement while keeping it readable at 375px and 1280px.',
    verificationRule: 'The H1 names a concrete customer outcome and remains readable at both captured widths.',
    pageUrl: null,
  },
  {
    id: 'flag-message-placeholder',
    checkId: 'placeholder-copy-detected',
    rubric: 'MESSAGE',
    severity: 'IMPORTANT',
    impactTag: 'CLARITY',
    problem: 'Feature copy contains placeholder language',
    evidence: `The first feature description starts with “${originalFixture.features[0]?.description ?? 'Lorem ipsum'}”.`,
    whyItMatters: 'Placeholder copy prevents visitors from evaluating the feature.',
    fix: 'Replace placeholder language with a specific pre-flight-check outcome.',
    agentPrompt: 'Replace the first feature description with a specific customer outcome and remove all placeholder wording.',
    verificationRule: 'No placeholder wording remains in the rendered feature section.',
    pageUrl: null,
  },
  {
    id: 'flag-reach-robots',
    checkId: 'robots-blocks-indexing',
    rubric: 'REACH',
    severity: 'CRITICAL',
    impactTag: 'SEO',
    problem: 'The page asks search engines not to index it',
    evidence: 'The curated fixture renders robots metadata with index and follow disabled.',
    whyItMatters: 'A noindex directive prevents the public page from appearing in search results.',
    fix: 'Allow indexing and following on the public launch page.',
    agentPrompt: 'Change the public page robots metadata to allow index and follow, then inspect the rendered head.',
    verificationRule: 'The rendered robots metadata permits indexing and following.',
    pageUrl: null,
  },
  {
    id: 'flag-reach-description',
    checkId: 'description-missing',
    rubric: 'REACH',
    severity: 'IMPORTANT',
    impactTag: 'SEO',
    problem: 'The page has no meta description',
    evidence: 'The curated fixture metadata has an empty description.',
    whyItMatters: 'Search engines must invent a result snippet when the page supplies no description.',
    fix: 'Add a concise description of the release-checklist outcome.',
    agentPrompt: 'Add a unique 120–158 character metadata description that states the product outcome.',
    verificationRule: 'The rendered head contains one non-empty meta description.',
    pageUrl: null,
  },
  {
    id: 'flag-reach-social-image',
    checkId: 'og-image-missing',
    rubric: 'REACH',
    severity: 'IMPORTANT',
    impactTag: 'SHARING',
    problem: 'Shared links have no Open Graph image',
    evidence: 'The curated fixture Open Graph metadata declares an empty images list.',
    whyItMatters: 'Shared links cannot show a branded visual preview.',
    fix: 'Add a 1200×630 Open Graph image with meaningful alt text.',
    agentPrompt: 'Add a 1200×630 Open Graph image to page metadata and verify the rendered og:image tag.',
    verificationRule: 'The rendered head contains an accessible og:image that resolves successfully.',
    pageUrl: null,
  },
  {
    id: 'flag-reach-canonical',
    checkId: 'canonical-missing',
    rubric: 'REACH',
    severity: 'POLISH',
    impactTag: 'SEO',
    problem: 'No canonical URL is declared',
    evidence: 'The curated fixture metadata does not declare a canonical URL.',
    whyItMatters: 'A canonical URL helps search engines consolidate duplicate page variants.',
    fix: 'Declare the public demo URL as canonical.',
    agentPrompt: 'Add the public demo URL to metadata alternates.canonical and inspect the rendered link element.',
    verificationRule: 'The rendered head contains exactly one canonical link.',
    pageUrl: null,
  },
]

const FIRST_REVIEW_FLAGS: readonly RankableFlag[] = ORIGINAL_FLAGS.map((flag) => ({
  ...flag,
  severity: flag.severity === 'POLISH' ? 'IMPORTANT' : 'CRITICAL',
}))

const STATIC_OBSERVATIONS: readonly StaticObservationDefinition[] = [
  {
    id: 'curated-sample-v0',
    revision: 'demo-v0-baseline',
    sourcePath: '/demo?baseline=1',
    completedAt: '2026-06-09T14:30:00Z',
    parentId: null,
    kind: 'product-review',
    verdict: 'The first review established the baseline and ranked the most urgent customer blockers.',
    flags: FIRST_REVIEW_FLAGS,
  },
  {
    id: LATEST_STATIC_SAMPLE_OBSERVATION_ID,
    revision: 'demo-original-regression',
    sourcePath: '/demo',
    completedAt: '2026-06-10T14:30:00Z',
    parentId: 'curated-sample-v0',
    kind: 'update-review',
    verdict: 'The update review shows progress while keeping the remaining conversion, message, and discovery issues visible.',
    flags: ORIGINAL_FLAGS,
  },
]

const OBSERVATION_BY_ID = new Map(STATIC_OBSERVATIONS.map((item) => [item.id, item]))

function deterministic(flag: RankableFlag): DeterministicFlag {
  return {
    checkId: flag.checkId ?? flag.id,
    rubric: flag.rubric,
    severity: flag.severity,
    problem: flag.problem,
    evidence: flag.evidence ?? '',
    fix: flag.fix ?? '',
    confidence: flag.confidence ?? 0.9,
    source: 'DETERMINISTIC',
    impactTag: flag.impactTag,
    pageUrl: flag.pageUrl ?? undefined,
  }
}

function scoresFor(flags: readonly RankableFlag[]): SampleRubricScores {
  return computeRubricScores(flags.map(deterministic), null, null, {
    pageSpeedAvailable: { desktop: false, mobile: false },
  })
}

function timelineLabels(definition: StaticObservationDefinition): string[] {
  return [
    `Opened curated snapshot ${definition.revision}`,
    'Captured desktop and mobile evidence',
    definition.flags.length > 0 ? 'Ranked the evidence-backed Flags' : 'Confirmed no curated Flags',
  ]
}

export function getStaticSampleCaptureDefinitions(): StaticSampleCaptureDefinition[] {
  return STATIC_OBSERVATIONS.map((definition) => ({
    id: definition.id,
    revision: definition.revision,
    sourcePath: definition.sourcePath,
    completedAt: definition.completedAt,
    score: calculateOverallScore(scoresFor(definition.flags)) ?? 0,
    flagIds: definition.flags.map((flag) => flag.id),
    timeline: timelineLabels(definition),
    anchorTargets: definition.flags.map((flag) => ({
      checkId: flag.checkId ?? flag.id,
      problem: flag.problem,
      evidence: flag.evidence ?? '',
    })),
  }))
}

export function getStaticSampleObservationIds(): readonly string[] {
  return STATIC_OBSERVATIONS.map((observation) => observation.id)
}

function manifest(): SampleCaptureManifest {
  return sampleBundleJson as unknown as SampleCaptureManifest
}

function completeBundle(definition: StaticObservationDefinition): SampleCaptureManifestEntry {
  const entry = manifest().observations?.[definition.id]
  const score = calculateOverallScore(scoresFor(definition.flags)) ?? 0
  const expectedTimeline = timelineLabels(definition)
  if (
    manifest().schemaVersion !== 1 ||
    !entry ||
    entry.revision !== definition.revision ||
    entry.sourcePath !== definition.sourcePath ||
    entry.reviewedAt !== definition.completedAt ||
    entry.score !== score ||
    entry.documentSha256.length !== 64 ||
    JSON.stringify(entry.flagIds) !== JSON.stringify(definition.flags.map((flag) => flag.id)) ||
    JSON.stringify(entry.timeline) !== JSON.stringify(expectedTimeline) ||
    !entry.captures.desktop.path ||
    !entry.captures.mobile.path ||
    entry.captures.desktop.sha256.length !== 64 ||
    entry.captures.mobile.sha256.length !== 64
  ) {
    throw new Error(`Curated sample observation ${definition.id} is incomplete or stale`)
  }
  return JSON.parse(JSON.stringify(entry)) as SampleCaptureManifestEntry
}

function cloneFlag(flag: RankableFlag): RankableFlag {
  return { ...flag }
}

function buildRubricRows(scores: SampleRubricScores, flags: RankableFlag[]): ReportRubricRow[] {
  const summaries = {
    MESSAGE: flags.some((flag) => flag.rubric === 'MESSAGE') ? 'The promise needs a more concrete outcome.' : 'No curated message Flags in this Review.',
    EXPERIENCE: flags.some((flag) => flag.rubric === 'EXPERIENCE') ? 'The primary CTA is below the first mobile viewport.' : 'No curated experience Flags in this Review.',
    REACH: flags.some((flag) => flag.rubric === 'REACH') ? 'Indexing and sharing metadata need attention.' : 'No curated reach Flags in this Review.',
  } as const
  return (['MESSAGE', 'EXPERIENCE', 'REACH'] as const).map((name) => ({
    id: `rubric-${name.toLowerCase()}`,
    name,
    summary: summaries[name],
    score: scores[name],
    grade: gradeFromScore(scores[name]),
    status: statusFromScore(scores[name]),
    flags: flags.filter((flag) => flag.rubric === name),
  }))
}

function historyPoints() {
  return STATIC_OBSERVATIONS.map((definition) => ({
    id: definition.id,
    href: `/samples?observation=${encodeURIComponent(definition.id)}&view=report`,
    score: calculateOverallScore(scoresFor(definition.flags)) ?? 0,
    checkedAt: new Date(definition.completedAt),
    kind: definition.kind,
    status: 'completed' as const,
  }))
}

function buildStaticSampleAudit(definition: StaticObservationDefinition): CuratedSampleAudit {
  const bundle = completeBundle(definition)
  const flags = definition.flags.map(cloneFlag)
  const scores = scoresFor(flags)
  const rubricRows = buildRubricRows(scores, flags)
  const rubricSources = rubricRows.map((row) => ({
    name: row.name,
    grade: row.grade,
    score: row.score,
    flags: row.flags.map((flag) => ({ severity: flag.severity })),
  }))
  const completedAt = new Date(definition.completedAt)
  const createdAt = new Date(completedAt.getTime() - 60_000)
  const sourceUrl = `${new URL(SAMPLE_URL).origin}${definition.sourcePath}`
  const [opened, captured, judged] = bundle.timeline

  return {
    accessContext: 'repository_sample',
    id: definition.id,
    url: SAMPLE_URL,
    pageJob: 'Curated demo fixture',
    pageType: 'Demo fixture',
    score: bundle.score,
    verdict: definition.verdict,
    completedAt,
    createdAt,
    parentId: definition.parentId,
    pipelineVersion: PIPELINE_VERSION,
    reportCompleteness: 'FULL',
    startedAt: createdAt,
    evidenceCoverage: { desktopPageSpeed: false, mobilePageSpeed: false },
    performanceData: { evidenceAnchors: bundle.anchors, sampleBundleRevision: bundle.revision, documentSha256: bundle.documentSha256 },
    rubrics: computeRubricsFromRows(rubricSources, flags),
    rubricRows,
    flags,
    shareStatus: computeShareStatusFromRubrics(rubricSources, flags),
    launchReadiness: {
      readiness: flags.length > 0 ? 'fix_first' : 'safe',
      checklist: [
        { id: 'capture', label: 'Demo captures generated', passed: true },
        { id: 'curated-flags', label: 'Curated Flags resolved', passed: true },
      ],
    },
    screenshots: [
      { device: 'DESKTOP', url: bundle.captures.desktop.path, width: bundle.captures.desktop.width, height: bundle.captures.desktop.height },
      { device: 'MOBILE', url: bundle.captures.mobile.path, width: bundle.captures.mobile.width, height: bundle.captures.mobile.height },
    ],
    productContract: {
      purpose: 'Help product teams run every release as a checklist with automated pre-flight checks',
      firstValueJourney: `Understand the release benefit, choose ${originalFixture.primaryCta.label}, and reach signup`,
      criticalOutcomes: ['The primary CTA is visible and opens signup', 'Visitors understand the release outcome', 'Shared links show a branded preview'],
      inferredAt: definition.completedAt,
      source: 'heuristic',
    },
    verifiedLearnings: [],
    scoreHistory: historyPoints(),
    previewMeta: {
      title: `${DEMO_BRAND.name} · Curated demo`,
      description: originalFixture.subhead,
      ogTitle: DEMO_BRAND.name,
      ogDescription: originalFixture.subhead,
      ogImage: null,
      ogImageOk: false,
      url: SAMPLE_URL,
    },
    flowData: {
      status: 'success',
      ctaText: originalFixture.primaryCta.label,
      ctaHref: originalFixture.primaryCta.href,
      finalUrl: `${SAMPLE_URL}/signup`,
      steps: [
        { label: opened, screenshotUrl: bundle.captures.desktop.path, url: sourceUrl },
        { label: captured, screenshotUrl: bundle.captures.mobile.path, url: sourceUrl },
      ],
    },
    actionTimeline: [
      { t: 0, kind: 'navigate', label: opened, url: sourceUrl, screenshot: bundle.captures.desktop.path },
      { t: 820, kind: 'capture', label: captured, url: sourceUrl, screenshot: bundle.captures.mobile.path },
      { t: 1460, kind: 'click', label: judged, url: sourceUrl, screenshot: bundle.captures.desktop.path },
    ],
    intentionalNotes: [
      'Versioned curated fixture. It does not represent a production customer Review.',
      `Captured from immutable demo snapshot ${bundle.revision}.`,
    ],
  }
}

/** Resolve a complete curated observation. Explicit unknown IDs fail closed. */
export function getStaticSampleAudit(observationId?: string | null): CuratedSampleAudit {
  const definition =
    observationId === undefined || observationId === null
      ? OBSERVATION_BY_ID.get(LATEST_STATIC_SAMPLE_OBSERVATION_ID)
      : OBSERVATION_BY_ID.get(observationId)
  if (!definition) throw new Error(`Unknown curated sample observation: ${observationId ?? 'latest'}`)
  return buildStaticSampleAudit(definition)
}
