import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { DEFAULT_SAMPLE_AUDIT_URL } from '@/lib/marketing/display-meta'
import { computeShareStatusFromRubrics, computeRubricsFromRows } from '@/lib/audit/rubric'
import type { ReportRubricRow } from '@/lib/audit/build-report-shape'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'

const SCREENSHOT_BASE = '/samples'
const SAMPLE_URL = DEFAULT_SAMPLE_AUDIT_URL

const STATIC_FLAGS: RankableFlag[] = [
  {
    id: 'flag-message-1',
    checkId: 'h1-generic',
    rubric: 'MESSAGE',
    severity: 'IMPORTANT',
    impactTag: 'CONVERSION',
    problem: 'Hero headline repeats the product category instead of the outcome',
    evidence:
      'Desktop 1280x900: headline reads "Build something amazing with AI" — describes the tool category, not the visitor outcome.',
    whyItMatters:
      'Outcome-driven headlines help visitors understand what they gain, not just what the product is.',
    fix: 'Lead with the outcome: who it is for and what they get after signing up.',
    agentPrompt:
      'Update the H1 to lead with outcome: "Ship a landing page your customers understand in 5 seconds." Keep under 12 words at 1280px viewport.',
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
    verificationRule: 'New headline fits single line at 1280px viewport width.',
    pageUrl: null,
  },
  {
    id: 'flag-experience-1',
    checkId: 'flow-no-cta-found',
    rubric: 'EXPERIENCE',
    severity: 'CRITICAL',
    impactTag: 'CONVERSION',
    problem: 'Primary CTA starts 1,200px below top on 375px viewport',
    evidence:
      'Mobile viewport 375x812: hero image pushes CTA to 1,200px scroll depth. Button hidden below fold.',
    whyItMatters:
      'At 375x812, the primary CTA starts at ~1,200px scroll depth, hidden below the fold on mobile.',
    fix: 'Reduce hero image height to 40vh on mobile. Stack CTA within first 700px of page height.',
    agentPrompt:
      'Add media query for max-width: 375px. Set hero image to 40vh max-height. Stack headline, subhead, and CTA vertically so CTA appears within first 700px.',
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
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
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
    verificationRule: 'Nav (incl announcement) is max 56px total at 375px viewport.',
    pageUrl: null,
  },
  {
    id: 'flag-reach-1',
    checkId: 'og-image-missing',
    rubric: 'REACH',
    severity: 'CRITICAL',
    impactTag: 'SHARING',
    problem: 'Missing og:image, link previews show blank cards',
    evidence:
      'HTML head has no og:image meta tag. Desktop 1280x900: no preview card in social embeds.',
    whyItMatters:
      'Shared links show blank preview cards on Slack, Twitter, and WhatsApp without og:image.',
    fix: 'Add og:image meta tag pointing to a 1200x630 brand card.',
    agentPrompt:
      'Add openGraph metadata with images: [{ url: \'/og-image.png\', width: 1200, height: 630 }]. Generate a 1200x630 brand card with logo + page title.',
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
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
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
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
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
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
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
    verificationRule: 'Browser tab shows brand icon after hard refresh.',
    pageUrl: null,
  },
]

const STATIC_RUBRIC_ROWS: ReportRubricRow[] = [
  {
    id: 'rubric-message',
    name: 'MESSAGE',
    grade: 'B',
    score: 82,
    status: 'NEEDS_ATTENTION',
    summary:
      'CTA visible above fold on desktop. Value proposition clear but could target developers more directly.',
    flags: STATIC_FLAGS.filter((f) => f.rubric === 'MESSAGE'),
  },
  {
    id: 'rubric-experience',
    name: 'EXPERIENCE',
    grade: 'C',
    score: 62,
    status: 'BLOCKED',
    summary:
      'CTA below fold at 375px viewport. Tap targets meet minimum size. Third-party scripts add render delay.',
    flags: STATIC_FLAGS.filter((f) => f.rubric === 'EXPERIENCE'),
  },
  {
    id: 'rubric-reach',
    name: 'REACH',
    grade: 'C',
    score: 65,
    status: 'BLOCKED',
    summary:
      'og:image missing. Link previews show blank cards on social platforms. Heading hierarchy is good.',
    flags: STATIC_FLAGS.filter((f) => f.rubric === 'REACH'),
  },
]

export function getStaticSampleAudit(): LiveSampleAudit {
  const rubricSources = STATIC_RUBRIC_ROWS.map((r) => ({
    name: r.name,
    grade: r.grade,
    score: r.score,
    flags: r.flags.map((f) => ({ severity: f.severity })),
  }))
  const rubrics = computeRubricsFromRows(rubricSources, STATIC_FLAGS)
  const shareStatus = computeShareStatusFromRubrics(rubricSources, STATIC_FLAGS)

  return {
    id: 'static-sample',
    url: SAMPLE_URL,
    pageJob: 'Landing page',
    pageType: 'Landing page',
    score: 78,
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
        url: `${SCREENSHOT_BASE}/demo-original-desktop.webp`,
        width: 1280,
        height: 900,
      },
      {
        device: 'MOBILE',
        url: `${SCREENSHOT_BASE}/demo-original-mobile.webp`,
        width: 375,
        height: 812,
      },
    ],
  }
}
