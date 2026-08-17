import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { computeShareStatusFromRubrics, computeRubricsFromRows } from '@/lib/audit/rubric'
import { calculateOverallScore, gradeFromScore, statusFromScore } from '@/lib/audit/scoring'
import type { ReportRubricRow } from '@/lib/audit/build-report-shape'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import type { CuratedSampleAudit } from '@/lib/marketing/curated-sample'
import { originalFixture } from '@/lib/demo/fixtures/original'
import { DEMO_BRAND } from '@/lib/demo/brand'

const SAMPLE_DESKTOP = '/samples/demo-original-desktop.webp'
const SAMPLE_MOBILE = '/samples/demo-original-mobile.webp'
const SAMPLE_URL = DEMO_BRAND.sampleUrl

const STATIC_FLAGS: RankableFlag[] = [
  {
    id: 'flag-message-1',
    checkId: 'h1-generic',
    rubric: 'MESSAGE',
    severity: 'IMPORTANT',
    impactTag: 'CONVERSION',
    problem: 'Hero headline repeats the product category instead of the outcome',
    evidence:
      `Desktop 1280x900: headline reads "${originalFixture.headline}". It names the category but not the concrete outcome a visitor gets.`,
    whyItMatters:
      'Outcome-driven headlines help visitors understand the gain before any feature detail.',
    fix: 'Lead with the outcome: who it is for and what they get after signing up.',
    agentPrompt:
      'Update the H1 to name the audience and outcome, for example: "Ship every release without a last-minute scramble." Keep it under 12 words at 1280px.',
    verificationRule: 'New headline fits single line at 1280px viewport width.',
    pageUrl: null,
  },
  {
    id: 'flag-experience-1',
    checkId: 'cta-below-fold-mobile',
    rubric: 'EXPERIENCE',
    severity: 'CRITICAL',
    impactTag: 'CONVERSION',
    problem: 'Primary CTA is hidden below the fold on mobile',
    evidence:
      'Mobile viewport 375x812: hero image pushes CTA below the fold. Button hidden without scrolling.',
    whyItMatters:
      'At 375x812, the primary CTA starts below the first screen, so mobile visitors may never see how to sign up.',
    fix: 'Reduce hero image height to 40vh on mobile. Stack CTA within the first 700px of page height.',
    agentPrompt:
      'Add media query for max-width: 375px. Set hero image to 40vh max-height. Stack headline, subhead, and CTA vertically so CTA appears within first 700px.',
    verificationRule: 'Chrome DevTools at 375x812: CTA button visible without scrolling.',
    pageUrl: null,
  },
  {
    id: 'flag-experience-2',
    checkId: 'tap-targets-small',
    rubric: 'EXPERIENCE',
    severity: 'IMPORTANT',
    impactTag: 'ACCESSIBILITY',
    problem: 'Navigation menu consumes 35% of viewport height on mobile',
    evidence:
      'Mobile 375x812: nav bar + announcement banner ~280px total before content starts.',
    whyItMatters:
      'Nav bar + announcement banner consume ~280px before content on an 812px viewport.',
    fix: 'Collapse announcement banner on mobile. Reduce nav padding. Use hamburger menu if nav links > 3.',
    agentPrompt:
      'At 375px breakpoint, hide secondary nav links behind hamburger toggle. Reduce announcement banner to 32px.',
    verificationRule: 'Nav (incl announcement) is max 56px total at 375px viewport.',
    pageUrl: null,
  },
  {
    id: 'flag-reach-1',
    checkId: 'og-image-missing',
    rubric: 'REACH',
    severity: 'IMPORTANT',
    impactTag: 'SHARING',
    problem: 'Missing og:image, link previews show blank cards',
    evidence:
      'HTML head has no og:image meta tag. Desktop 1280x900: no preview card in social embeds.',
    whyItMatters:
      'Shared links show blank preview cards on Slack, Twitter, and WhatsApp without og:image.',
    fix: 'Add og:image meta tag pointing to a 1200x630 brand card.',
    agentPrompt:
      'Add openGraph metadata with images: [{ url: \'/og-image.png\', width: 1200, height: 630 }]. Generate a 1200x630 brand card with logo + page title.',
    verificationRule: 'Twitter Card Validator shows image + title + description.',
    pageUrl: null,
  },
  {
    id: 'flag-reach-2',
    checkId: 'description-missing',
    rubric: 'REACH',
    severity: 'IMPORTANT',
    impactTag: 'SEO',
    problem: 'No meta description on the page',
    evidence: 'HTML head lacks meta description tag. Google shows auto-generated snippets.',
    whyItMatters:
      'Missing meta description lets search engines generate snippets that may not match your value proposition.',
    fix: 'Add meta description (120-158 chars) with value proposition.',
    agentPrompt:
      'In metadata export, add `description` with your value proposition. Keep under 160 characters.',
    verificationRule: 'Page source shows meta description tag with 120-158 chars.',
    pageUrl: null,
  },
  {
    id: 'flag-experience-3',
    checkId: 'render-blocking',
    rubric: 'EXPERIENCE',
    severity: 'POLISH',
    impactTag: null,
    problem: 'Third-party analytics adds measurable render delay',
    evidence:
      'Scripts loaded from analytics and font providers. Combined blocking time ~80ms on desktop 1280x900.',
    whyItMatters: 'Blocking scripts delay first paint and push interactive content later.',
    fix: 'Defer or async-load non-critical third-party scripts.',
    agentPrompt:
      'Find script tags loading analytics and font providers. Add `async` or `defer` to non-critical scripts.',
    verificationRule: 'Run Lighthouse. Main-thread blocking time should be under 30ms.',
    pageUrl: null,
  },
  {
    id: 'flag-reach-3',
    checkId: 'favicon-missing',
    rubric: 'REACH',
    severity: 'POLISH',
    impactTag: null,
    problem: 'No favicon linked in the page head',
    evidence:
      'HTML head has no favicon link. Browser tab shows a generic document icon on desktop and mobile.',
    whyItMatters:
      'A missing favicon makes the site look unfinished in browser tabs and bookmarks.',
    fix: 'Add a favicon.ico or PNG favicon link in the document head.',
    agentPrompt:
      'Add `<link rel="icon" href="/favicon.ico" sizes="any" />` to the site metadata or layout head.',
    verificationRule: 'Browser tab shows brand icon after hard refresh.',
    pageUrl: null,
  },
]

const RUBRIC_SCORES = {
  MESSAGE: 82,
  EXPERIENCE: 62,
  REACH: 65,
} as const

const STATIC_RUBRIC_ROWS: ReportRubricRow[] = (
  [
    {
      id: 'rubric-message',
      name: 'MESSAGE' as const,
      summary:
        'CTA is visible above the fold on desktop, but the headline does not identify the audience or a concrete outcome.',
    },
    {
      id: 'rubric-experience',
      name: 'EXPERIENCE' as const,
      summary:
        'CTA below fold at 375px viewport. Tap targets meet minimum size. Third-party scripts add render delay.',
    },
    {
      id: 'rubric-reach',
      name: 'REACH' as const,
      summary:
        'og:image missing. Link previews show blank cards on social platforms. Heading hierarchy is good.',
    },
  ] as const
).map((row) => {
  const score = RUBRIC_SCORES[row.name]
  return {
    ...row,
    score,
    grade: gradeFromScore(score),
    status: statusFromScore(score),
    flags: STATIC_FLAGS.filter((f) => f.rubric === row.name),
  }
})

export function getStaticSampleAudit(): CuratedSampleAudit {
  const rubricSources = STATIC_RUBRIC_ROWS.map((r) => ({
    name: r.name,
    grade: r.grade,
    score: r.score,
    flags: r.flags.map((f) => ({ severity: f.severity })),
  }))
  const rubrics = computeRubricsFromRows(rubricSources, STATIC_FLAGS)
  const shareStatus = computeShareStatusFromRubrics(rubricSources, STATIC_FLAGS)
  const overall =
    calculateOverallScore({
      MESSAGE: RUBRIC_SCORES.MESSAGE,
      EXPERIENCE: RUBRIC_SCORES.EXPERIENCE,
      REACH: RUBRIC_SCORES.REACH,
    }) ?? 70

  return {
    id: 'curated-sample-v1',
    url: SAMPLE_URL,
    pageJob: 'Demo fixture',
    pageType: 'Demo fixture',
    score: overall,
    verdict:
      'Solid foundation with gaps in mobile hero layout, vague messaging, and social preview metadata.',
    completedAt: new Date('2026-06-10T14:30:00Z'),
    createdAt: new Date('2026-06-10T14:29:00Z'),
    pipelineVersion: PIPELINE_VERSION,
    reportCompleteness: 'FULL',
    startedAt: new Date('2026-06-10T14:29:00Z'),
    rubrics,
    rubricRows: STATIC_RUBRIC_ROWS,
    flags: STATIC_FLAGS,
    shareStatus,
    launchReadiness: {
      readiness: 'fix_first',
      checklist: [
        { id: 'https', label: 'HTTPS enabled', passed: true },
        { id: 'social-preview', label: 'Social preview image (og:image)', passed: false },
        { id: 'mobile-cta', label: 'Primary CTA visible on mobile', passed: false },
        { id: 'console-errors', label: 'No critical console errors', passed: true },
        { id: 'privacy-contact', label: 'Privacy policy and contact info linked', passed: true },
      ],
    },
    screenshots: [
      {
        device: 'DESKTOP',
        url: SAMPLE_DESKTOP,
        width: 1280,
        height: 900,
      },
      {
        device: 'MOBILE',
        url: SAMPLE_MOBILE,
        width: 375,
        height: 812,
      },
    ],
    productContract: {
      purpose: 'Help product teams run every release as a checklist with automated pre-flight checks',
      firstValueJourney: `Understand the release benefit, choose ${originalFixture.primaryCta.label}, and reach signup`,
      criticalOutcomes: [
        'The primary CTA is visible and opens signup',
        `Visitors understand how ${DEMO_BRAND.name} verifies a release before rollout`,
        'Shared links show a branded preview',
      ],
      inferredAt: '2026-06-10T14:30:00Z',
      source: 'heuristic',
    },
    verifiedLearnings: [
      {
        checkId: 'cta-visible-desktop',
        summary: 'The primary CTA remains visible above the fold at 1280px.',
        auditId: 'curated-sample-v0',
        at: '2026-06-09T14:30:00Z',
      },
    ],
    scoreHistory: [
      {
        id: 'curated-sample-v0',
        score: 61,
        checkedAt: new Date('2026-06-02T14:30:00Z'),
        kind: 'product-review',
        status: 'completed',
      },
      {
        id: 'curated-sample-v0-1',
        score: 64,
        checkedAt: new Date('2026-06-04T14:30:00Z'),
        kind: 'update-review',
        status: 'completed',
      },
      {
        id: 'curated-sample-v0-2',
        score: 63,
        checkedAt: new Date('2026-06-06T14:30:00Z'),
        kind: 'update-review',
        status: 'completed',
      },
      {
        id: 'curated-sample-v0-3',
        score: 67,
        checkedAt: new Date('2026-06-08T14:30:00Z'),
        kind: 'update-review',
        status: 'completed',
      },
      {
        id: 'curated-sample-v1',
        score: overall,
        checkedAt: new Date('2026-06-10T14:30:00Z'),
        kind: 'update-review',
        status: 'completed',
      },
    ],
    previewMeta: {
      title: `${DEMO_BRAND.name} · Release checklists for product teams`,
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
        { label: 'Landing page', screenshotUrl: SAMPLE_DESKTOP, url: SAMPLE_URL },
        { label: 'Primary CTA', screenshotUrl: SAMPLE_DESKTOP, url: `${SAMPLE_URL}/signup` },
      ],
    },
    actionTimeline: [
      {
        t: 0,
        kind: 'navigate',
        label: `Opened the ${DEMO_BRAND.name} landing page`,
        url: SAMPLE_URL,
        screenshot: SAMPLE_DESKTOP,
      },
      {
        t: 820,
        kind: 'capture',
        label: 'Captured desktop and mobile evidence',
        url: SAMPLE_URL,
        screenshot: SAMPLE_MOBILE,
      },
      {
        t: 1460,
        kind: 'click',
        label: `Clicked ${originalFixture.primaryCta.label}`,
        url: `${SAMPLE_URL}/signup`,
        screenshot: SAMPLE_DESKTOP,
      },
    ],
  }
}
