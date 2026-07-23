import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  BRAND,
  CHANGELOG_ENTRIES,
  DIFFERENTIATION,
  FINAL_CTA,
  HERO,
  HOW_IT_WORKS_PAGE,
  LANDING_PAGE,
  MCP_SECTION,
  OUTPUT_LABELS,
  PRICING,
  PRICING_FAQ,
  REPORT_COPY,
  SEO,
} from '@/lib/marketing/copy'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'

const FORBIDDEN_TAXONOMY = /\b7 areas\b|\bseven areas\b/i

const BANNED_LANDING_PHRASES = [
  /second pass/i,
  /flag it/i,
  /ship tonight/i,
  /fix my live site/i,
  /start in 60 seconds/i,
  /\bunlock\b/i,
  /\b10x\b/i,
  /game-changing/i,
  /world-class/i,
  /comprehensive/i,
  /robust/i,
  /\bleverage\b/i,
  /holistic/i,
] as const

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value)
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out)
  }
  return out
}

const LANDING_MARKETING_STRINGS = [
  ...collectStrings(LANDING_PAGE),
  ...collectStrings(FINAL_CTA),
]

const CORE_LOOP_STRINGS = [
  ...collectStrings(HOW_IT_WORKS_PAGE),
  ...collectStrings(LANDING_PAGE.howItWorks),
  ...collectStrings(FINAL_CTA),
]

const PRICING_STRINGS = [
  ...collectStrings(PRICING),
  ...collectStrings(PRICING_FAQ),
]

const ABOVE_FOLD_COPY = [
  HERO.headline,
  HERO.headlineLine1,
  HERO.headlineLine2,
  HERO.subhead,
  HOW_IT_WORKS_PAGE.hero.subhead,
  ...LANDING_PAGE.howItWorks.steps.map((s) => s.body),
  SEO.home.title,
  SEO.home.description,
  BRAND.tagline,
  BRAND.oneLiner,
  LANDING_PAGE.checkDimensions.headline,
  LANDING_PAGE.howItWorks.headline,
]

describe('homepage message guardrails', () => {
  it('hero headline names the finish-the-loop moment after AI builds', () => {
    assert.match(HERO.badge, /check/i)
    assert.match(HERO.headlineAccent, /finish/i)
    assert.equal(
      HERO.headline,
      `${HERO.headlineAccent} ${HERO.headlineLine1} ${HERO.headlineLine2}`,
    )
  })

  it('above-fold copy avoids internal "7 areas" taxonomy', () => {
    for (const line of ABOVE_FOLD_COPY) {
      assert.ok(!FORBIDDEN_TAXONOMY.test(line), `Taxonomy leak: ${line}`)
    }
  })

  it('hero subhead explains input, analysis, and fix output', () => {
    assert.match(HERO.subhead, /paste your url/i)
    assert.match(HERO.subhead, /ai missed|flags/i)
    assert.match(HERO.subhead, /copy fixes/i)
    assert.ok(HERO.subhead.split(/\s+/).length <= 40)
    assert.ok(!HERO.subhead.toLowerCase().includes('finish what your ai started'))
  })

  it('hero has no CYA trust-badge row; value lives in OFFER.short', async () => {
    const { OFFER } = await import('@/lib/marketing/copy')
    assert.ok(!('trustBadges' in HERO))
    assert.match(OFFER.short, /free check/i)
    assert.match(OFFER.short, /what.?s broken/i)
    assert.ok(!/read-only/i.test(OFFER.short))
    assert.ok(!/claim/i.test(OFFER.short))
    assert.ok(!/never modify/i.test(OFFER.short))
  })

  it('secondary sample CTA uses human review language', () => {
    assert.equal(HERO.trySampleCta, 'See a sample review')
    assert.ok(!('trySampleHint' in HERO))
  })

  it('offer is standardized across hero surfaces and final CTA', async () => {
    const { OFFER } = await import('@/lib/marketing/copy')
    assert.match(OFFER.line, /free check/i)
    assert.match(OFFER.line, /fix prompts/i)
    assert.match(OFFER.privacy, /do not change your site/i)
    assert.match(OFFER.linkPrivacy, /private to your account/i)
    assert.match(FINAL_CTA.body, /free check/i)
  })

  it('landing and hero avoid CYA, readiness jargon, and banned unlock', () => {
    const surfaces = [
      ...LANDING_MARKETING_STRINGS,
      HERO.headline,
      HERO.subhead,
      FINAL_CTA.body,
      LANDING_PAGE.logoCloud.disclaimer,
    ]
    for (const line of surfaces) {
      assert.ok(!/compatibility is not endorsement/i.test(line), `CYA disclaimer: ${line}`)
      assert.ok(!/claim the report/i.test(line), `Claim CYA on marketing: ${line}`)
      assert.ok(!/fix prompt ready/i.test(line), `Readiness jargon: ${line}`)
      assert.ok(!/agent-ready/i.test(line), `Readiness jargon: ${line}`)
      assert.ok(!/\bunlock\b/i.test(line), `Banned unlock: ${line}`)
    }
  })

  it('OUTPUT_LABELS fix prompt label and next step are defined', () => {
    assert.equal(OUTPUT_LABELS.fixPrompt, 'Fix prompt')
    assert.equal(OUTPUT_LABELS.nextStep, 'Paste into editor → run → re-check.')
  })

  it('report copy names the free core-loop action as re-check', () => {
    assert.equal(REPORT_COPY.recheck.label, 'Re-check')
    assert.match(REPORT_COPY.recheckHint.title, /prove your fixes worked/i)
    assert.match(REPORT_COPY.recheckHint.bodySuffix, /Flags cleared/i)
  })

  it('core-loop copy consistently uses re-check', () => {
    assert.ok(CORE_LOOP_STRINGS.some((line) => /re-check/i.test(line)))
    for (const line of CORE_LOOP_STRINGS) {
      assert.doesNotMatch(line, /\bmonitor(?:ed|ing|s)?\b/i)
      assert.doesNotMatch(line, /\bre-?scan\b/i)
    }
    assert.equal(LANDING_PAGE.howItWorks.steps.at(-1)?.title, 'Re-check')
  })

  it('pricing keeps re-checks free and sells actual paid value', () => {
    assert.match(PRICING.trustBadge, /unlimited re-checks/i)
    assert.ok(
      PLAN_DEFINITIONS.FREE.features.some((feature) => /unlimited re-checks/i.test(feature))
    )
    assert.ok(
      PLAN_DEFINITIONS.BUILDER.features.some((feature) => /before\/after/i.test(feature))
    )
    assert.ok(
      PLAN_DEFINITIONS.BUILDER.features.some((feature) => /25 new URL checks/i.test(feature))
    )
    assert.doesNotMatch(PLAN_DEFINITIONS.BUILDER.features.join(' '), /unlimited re-check/i)
    for (const line of PRICING_STRINGS) {
      assert.doesNotMatch(line, /\bmonitor(?:ed|ing|s)?\b/i)
      assert.doesNotMatch(line, /founding price/i)
    }
  })

  it('agent workflow has intro and closing lines', () => {
    assert.ok(MCP_SECTION.intro.length > 0)
    assert.ok(MCP_SECTION.closing.length > 0)
  })

  it('primary CTA uses visitor-facing check language', () => {
    assert.equal(HERO.primaryCta, 'Review my site')
    assert.equal(HERO.navSignUpCta, HERO.primaryCta)
    assert.ok(!/try free/i.test(HERO.navSignUpCta))
    assert.ok(!/audit/i.test(HERO.primaryCta))
    assert.match(FINAL_CTA.headlineAccent, /fix/i)
    assert.ok(!/flag it/i.test(FINAL_CTA.headlineAccent))
  })

  it('DIFFERENTIATION has at most 3 bullets and 5 comparison rows', () => {
    assert.ok(DIFFERENTIATION.bullets.length <= 3)
    assert.ok(DIFFERENTIATION.bullets.length >= 1)
    assert.equal(DIFFERENTIATION.comparisonRows.length, 5)
  })

  it('differentiation lighthouse link text is descriptive', () => {
    assert.match(DIFFERENTIATION.lighthouseLinkText, /Lighthouse/i)
    assert.ok(!/^Google Lighthouse docs$/i.test(DIFFERENTIATION.lighthouseLinkText))
  })

  it('landing marketing strings avoid banned insider phrases', () => {
    for (const line of LANDING_MARKETING_STRINGS) {
      for (const pattern of BANNED_LANDING_PHRASES) {
        assert.ok(!pattern.test(line), `Banned phrase (${pattern}) in: ${line}`)
      }
    }
  })

  it('how it works section has 3-step loop copy', () => {
    assert.ok(!('problemBar' in LANDING_PAGE.howItWorks))
    assert.match(LANDING_PAGE.howItWorks.headline, /three steps/i)
    assert.ok(LANDING_PAGE.howItWorks.subhead.length > 0)
    assert.match(LANDING_PAGE.howItWorks.sampleLink, /sample review/i)
    assert.equal(LANDING_PAGE.howItWorks.steps.length, 3)
  })

  it('flag step avoids unverifiable flag counts in preview', () => {
    const flag = LANDING_PAGE.howItWorks.steps.find((s) => s.title === 'Flag')
    assert.ok(flag)
    assert.ok(!/\b\d+\b/.test(flag!.preview))
  })

  it('re-check step avoids synthetic score delta in preview', () => {
    const recheck = LANDING_PAGE.howItWorks.steps.find((s) => s.title === 'Re-check')
    assert.ok(recheck)
    assert.ok(!recheck!.preview.includes('+32%'))
    assert.ok(!recheck!.preview.toLowerCase().includes('score improved'))
  })

  it('dimension cards have checklists and proof examples', () => {
    assert.equal(LANDING_PAGE.checkDimensions.cards.length, 3)
    for (const card of LANDING_PAGE.checkDimensions.cards) {
      assert.ok('checks' in card)
      assert.ok(card.checks.length >= 4)
      assert.ok('proofExample' in card)
      assert.ok(card.proofExample.finding.length > 0)
      assert.ok(card.proofExample.evidence.length > 0)
    }
  })

  it('empty testimonials invariant holds without inventing quotes', () => {
    assert.match(LANDING_PAGE.testimonials.disclaimer, /not attributed/i)
    assert.equal(LANDING_PAGE.testimonials.quotes.length, 0)
    assert.equal(LANDING_PAGE.productEvidence.items.length, 3)
  })

  it('report examples are Flag-shaped product findings', () => {
    assert.equal(LANDING_PAGE.reportExamples.cards.length, 4)
    const topics = LANDING_PAGE.reportExamples.cards.map((c) => c.topic)
    assert.ok(topics.some((t) => /messaging/i.test(t)))
    assert.ok(topics.some((t) => /mobile/i.test(t)))
    assert.ok(topics.some((t) => /accessibility/i.test(t)))
    assert.ok(topics.some((t) => /seo|sharing/i.test(t)))
    for (const card of LANDING_PAGE.reportExamples.cards) {
      assert.ok(card.problem.length > 0)
      assert.ok(card.evidence.length > 0)
      assert.ok(['MESSAGE', 'EXPERIENCE', 'REACH'].includes(card.rubric))
      assert.ok(['CRITICAL', 'IMPORTANT', 'POLISH'].includes(card.severity))
    }
  })

  it('why AI and editor integrations sections exist', () => {
    assert.match(LANDING_PAGE.whyAiNeedsFixFlags.headline, /AI ships the build/i)
    assert.match(LANDING_PAGE.whyAiNeedsFixFlags.lead, /AI builds fast/i)
    assert.ok(LANDING_PAGE.whyAiNeedsFixFlags.checks.length >= 5)
    assert.match(LANDING_PAGE.editorIntegrations.headline, /Cursor|Claude|Lovable/i)
  })

  it('sample report section links to the full sample review', () => {
    assert.equal(LANDING_PAGE.sampleReport.cta, 'View full sample review')
    assert.equal(LANDING_PAGE.sampleReport.ctaWithCount(7), 'View full sample review')
  })

  it('landing page exposes three-rubric check story', () => {
    assert.match(LANDING_PAGE.checkDimensions.headline, /what your page says/i)
    assert.deepEqual(
      LANDING_PAGE.checkDimensions.cards.map((c) => c.title),
      ['Message', 'Experience', 'Reach']
    )
    assert.match(LANDING_PAGE.checkDimensions.cards[0].question, /understand and care/i)
    assert.match(LANDING_PAGE.howItWorks.headline, /three steps/i)
    assert.match(LANDING_PAGE.sampleReport.body, /fix prompt/i)
    assert.match(LANDING_PAGE.logoCloud.label, /tools you already use/i)
    assert.deepEqual([...LANDING_PAGE.logoCloud.logos], [
      'Cursor',
      'Lovable',
      'Bolt',
      'Replit',
      'Claude Code',
      'Codex',
      'Windsurf',
    ])
    assert.equal(LANDING_PAGE.reportExamples.cards.length, 4)
    assert.deepEqual(
      LANDING_PAGE.productEvidence.items.map((i) => i.title),
      ['Message', 'Experience', 'Reach']
    )
  })

  it('CHANGELOG_ENTRIES are user-facing: no internal terminology, no implementation details', () => {
    const internalTerms = [
      /\bscan\b/i,
      /\bmodule\b/i,
      /\bendpoint\b/i,
      /\brefactor\b/i,
      /\bmigration\b/i,
      /\bPR\b/i,
      /\bcommit\b/i,
      /\bdeploy\b/i,
      /\bpipeline\b/i,
    ]
    for (const entry of CHANGELOG_ENTRIES) {
      for (const item of entry.items) {
        for (const pattern of internalTerms) {
          assert.ok(!pattern.test(item), `Internal term (${pattern}) in changelog item: ${item}`)
        }
      }
      assert.ok(entry.items.length >= 3, `Changelog entry has too few items: ${entry.title}`)
    }
  })

  it('samples SEO references PlantDad demo, not homepage dogfood', () => {
    assert.match(SEO.samples.description, /PlantDad demo/i)
    assert.ok(!/our own homepage/i.test(SEO.samples.description))
  })
})
