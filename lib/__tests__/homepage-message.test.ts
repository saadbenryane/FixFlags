import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  AUTH,
  BRAND,
  CHANGELOG_ENTRIES,
  DIFFERENTIATION,
  FAQ,
  FINAL_CTA,
  HERO,
  HOW_IT_WORKS_PAGE,
  LANDING_PAGE,
  LOCKED_CONTENT_TEASER,
  MCP_SECTION,
  OUTPUT_LABELS,
  PLANS,
  PRICING,
  PRICING_FAQ,
  REPORT_COPY,
  SEO,
} from '@/lib/marketing/copy'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { BANNED_CUSTOMER_PHRASES } from '@/lib/marketing/copy/terminology'
import { HOMEPAGE_EDITOR_INTEGRATIONS } from '@/lib/integrations/editor-catalog'

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
  /seamless/i,
  /\bjourneys?\b/i,
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
  HERO.headlineDisplay,
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

const COPY_BARREL_STRINGS = [
  ...collectStrings(LANDING_PAGE),
  ...collectStrings(PLANS),
  ...collectStrings(PRICING_FAQ),
  ...collectStrings(FAQ),
  ...collectStrings(AUTH),
]

describe('homepage message guardrails', () => {
  it('marketing copy barrel avoids banned customer phrases', () => {
    for (const line of COPY_BARREL_STRINGS) {
      for (const pattern of BANNED_CUSTOMER_PHRASES) {
        assert.doesNotMatch(line, pattern, `Banned phrase (${pattern}) in: ${line}`)
      }
    }
  })

  it('canonical terminology anchors stay aligned', () => {
    assert.equal(HERO.primaryCta, 'Review my site')
    assert.equal(PLAN_DEFINITIONS.BUILDER.price, '$69')
    assert.equal(REPORT_COPY.sectionTitles.journey, 'Funnel')
    assert.equal(REPORT_COPY.recheck.label, 'Update review')
  })

  it('hero headline names the finish-the-loop moment after AI builds', () => {
    assert.match(HERO.badge, /product qa/i)
    assert.match(HERO.headlineDisplay, /finish what your ai started/i)
    assert.equal(HERO.headline, `${HERO.headlineDisplay}.`)
    assert.equal(HERO.headlineAccentPeriod, true)
  })

  it('above-fold copy avoids internal "7 areas" taxonomy', () => {
    for (const line of ABOVE_FOLD_COPY) {
      assert.ok(!FORBIDDEN_TAXONOMY.test(line), `Taxonomy leak: ${line}`)
    }
  })

  it('hero subhead leads with the URL action and names the report value', () => {
    assert.match(HERO.subhead, /^Paste a URL\./i)
    assert.match(HERO.subhead, /message/i)
    assert.match(HERO.subhead, /experience/i)
    assert.match(HERO.subhead, /reach/i)
    assert.match(HERO.subhead, /fix/i)
    assert.ok(HERO.subhead.split(/\s+/).length <= 20)
    assert.ok(!HERO.subhead.toLowerCase().includes('finish what your ai started'))
  })

  it('hero assurances are product-true and skip invented social proof', () => {
    assert.ok(HERO.assurances.length >= 3)
    for (const item of HERO.assurances) {
      assert.ok(!/\d{2,},\d{3}/.test(item.label), `Invented count: ${item.label}`)
      assert.ok(!/builders? reviewed/i.test(item.label), `Fake social proof: ${item.label}`)
    }
    assert.ok(HERO.assurances.some((a) => /under 60 seconds/i.test(a.label)))
    assert.ok(HERO.assurances.some((a) => /3 product reviews included/i.test(a.label)))
    assert.ok(HERO.assurances.some((a) => /private/i.test(a.label)))
    assert.match(HERO.trustLine, /Cursor/i)
    assert.match(HERO.trustLine, /Claude Code/i)
    assert.doesNotMatch(HERO.trustLine, /trusted by/i)
    assert.ok(!/\d{2,},\d{3}/.test(HERO.trustLine), `Invented count in trust line: ${HERO.trustLine}`)
    assert.match(HERO.scrollHint, /scroll to discover/i)
  })

  it('hero has no CYA trust-badge row; value lives in OFFER.short', async () => {
    const { OFFER } = await import('@/lib/marketing/copy')
    assert.ok(!('trustBadges' in HERO))
    assert.match(OFFER.short, /free product review/i)
    assert.match(OFFER.short, /needs attention/i)
    assert.doesNotMatch(OFFER.short, /broken|issues/i)
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
    assert.match(OFFER.line, /free product review/i)
    assert.match(OFFER.line, /fix prompts/i)
    assert.match(OFFER.privacy, /do not change your site/i)
    assert.match(OFFER.linkPrivacy, /private to your account/i)
    assert.match(FINAL_CTA.body, /free product review/i)
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
    assert.equal(OUTPUT_LABELS.nextStep, 'Paste into editor → publish → update review.')
  })

  it('report copy names the core-loop action as update review', () => {
    assert.equal(REPORT_COPY.recheck.label, 'Update review')
    assert.match(REPORT_COPY.recheckHint.title, /prove your fixes worked/i)
    assert.match(REPORT_COPY.recheckHint.bodySuffix, /Flags cleared/i)
  })

  it('core-loop copy consistently uses update review', () => {
    assert.ok(CORE_LOOP_STRINGS.some((line) => /update review/i.test(line)))
    for (const line of CORE_LOOP_STRINGS) {
      assert.doesNotMatch(line, /\bmonitor(?:ed|ing|s)?\b/i)
      assert.doesNotMatch(line, /\bre-?scan\b/i)
      assert.doesNotMatch(line, /\bre-?checks?\b/i)
    }
    assert.match(LANDING_PAGE.howItWorks.steps.at(-1)?.body ?? '', /update review/i)
  })

  it('pricing sells product reviews and deep reviews without unlimited re-check', () => {
    assert.match(PRICING.trustBadge, /product reviews/i)
    assert.doesNotMatch(PRICING.trustBadge, /unlimited re-checks/i)
    assert.ok(
      PLAN_DEFINITIONS.FREE.features.some((feature) => /product reviews.*lifetime/i.test(feature))
    )
    assert.ok(
      PLAN_DEFINITIONS.BUILDER.features.some((feature) => /before\/after/i.test(feature))
    )
    assert.ok(
      PLAN_DEFINITIONS.BUILDER.features.some((feature) => /deep reviews/i.test(feature))
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

  it('primary CTA uses visitor-facing review language', () => {
    assert.equal(HERO.primaryCta, 'Review my site')
    assert.ok(!/audit/i.test(HERO.primaryCta))
    assert.equal(FINAL_CTA.headlineDisplay, 'See what your release still needs')
    assert.ok(!/[.?]$/.test(FINAL_CTA.headlineDisplay))
    assert.equal(FINAL_CTA.headlineAccentPeriod, true)
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
    assert.equal(LANDING_PAGE.howItWorks.sampleLink, LANDING_PAGE.sampleReport.cta)
    assert.equal(LANDING_PAGE.howItWorks.steps.length, 3)
  })

  it('how it works steps keep product-true rubrics without decorative artwork contracts', () => {
    assert.deepEqual(
      LANDING_PAGE.howItWorks.steps.map((s) => s.title),
      ['Start your product review', 'We review the live product', 'Fix it. Review again.']
    )
    const scan = LANDING_PAGE.howItWorks.steps[1]!
    assert.match(scan.body, /Message, Experience, and Reach/i)
    assert.doesNotMatch(scan.body, /performance, accessibility, SEO/i)
    assert.ok(LANDING_PAGE.howItWorks.steps.every((step) => !('visual' in step)))
  })

  it('dimension cards have checklists and proof examples', () => {
    assert.equal(LANDING_PAGE.checkDimensions.cards.length, 3)
    assert.equal(LANDING_PAGE.checkDimensions.values.length, 4)
    for (const card of LANDING_PAGE.checkDimensions.cards) {
      assert.ok('checks' in card)
      assert.ok(card.checks.length >= 4)
      assert.ok('proofExample' in card)
      assert.ok(card.proofExample.finding.length > 0)
      assert.ok(card.proofExample.evidence.length > 0)
      assert.ok(card.topIssues.length >= 3)
      assert.ok(card.panelTitle.length > 0)
    }
    assert.equal(LANDING_PAGE.checkDimensions.allChecks.checks.length, 4)
    assert.deepEqual(
      [...new Set(LANDING_PAGE.checkDimensions.allChecks.topIssues.map((issue) => issue.category))].sort(),
      ['experience', 'message', 'reach']
    )
  })

  it('product evidence holds real product findings', () => {
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

  it('why builders and editor integrations sections exist', () => {
    assert.ok(!('whyAiNeedsFixFlags' in LANDING_PAGE))
    assert.match(LANDING_PAGE.whyBuildersChoose.headlineDisplay, /more than a score/i)
    assert.equal(LANDING_PAGE.whyBuildersChoose.demo.flags.length, 3)
    assert.match(LANDING_PAGE.editorIntegrations.headlineDisplay, /workflow/i)
    assert.match(LANDING_PAGE.editorIntegrations.label, /MCP/i)
    assert.equal(LANDING_PAGE.editorIntegrations.workspace.states.length, 3)
  })

  it('editor integrations headline avoids banned jargon and template copy', () => {
    const { editorIntegrations } = LANDING_PAGE
    for (const line of [
      editorIntegrations.headlineDisplay,
      editorIntegrations.headline,
      editorIntegrations.body,
      ...editorIntegrations.workspace.states.flatMap((state) => [
        state.title,
        state.body,
      ]),
    ]) {
      for (const pattern of BANNED_LANDING_PHRASES) {
        assert.ok(!pattern.test(line), `Banned phrase (${pattern}) in editor integrations: ${line}`)
      }
      assert.ok(!/coming soon/i.test(line), `Template copy in editor integrations: ${line}`)
    }
  })

  it('anonymous report CTA avoids banned words', () => {
    for (const line of collectStrings(LOCKED_CONTENT_TEASER)) {
      for (const pattern of BANNED_LANDING_PHRASES) {
        assert.ok(!pattern.test(line), `Banned phrase (${pattern}) in anonymous CTA: ${line}`)
      }
    }
  })

  it('sample report section links to the full sample review', () => {
    assert.equal(LANDING_PAGE.sampleReport.cta, 'Explore a full report')
    assert.equal(LANDING_PAGE.sampleReport.ctaWithCount(7), 'Explore a full report')
    assert.match(LANDING_PAGE.sampleReport.headlineDisplay, /exactly what ai misses/i)
    assert.match(LANDING_PAGE.sampleReport.label, /sample report/i)
    assert.match(LANDING_PAGE.sampleReport.body, /live product/i)
    assert.match(LANDING_PAGE.sampleReport.body, /editor-ready fix/i)
    assert.ok(!/\d{2,},\d{3}/.test(LANDING_PAGE.sampleReport.body))
    assert.equal(LANDING_PAGE.sampleReport.trustMetrics.length, 4)
    for (const metric of LANDING_PAGE.sampleReport.trustMetrics) {
      assert.ok(!/\d{2,},\d{3}/.test(metric.value), `Invented count: ${metric.value}`)
      assert.ok(!/manual review/i.test(metric.label), `Unsupported claim: ${metric.label}`)
    }
    assert.equal(REPORT_COPY.workspace.heading, 'Your review')
    assert.equal(REPORT_COPY.workspace.criticalFlags, 'Critical Flags')
  })

  it('landing page exposes three-rubric check story', () => {
    assert.equal(
      LANDING_PAGE.checkDimensions.headlineDisplay,
      'Three rubrics. One clear fix list'
    )
    assert.deepEqual(
      LANDING_PAGE.checkDimensions.cards.map((c) => c.title),
      ['Message', 'Experience', 'Reach']
    )
    assert.match(LANDING_PAGE.checkDimensions.cards[0].question, /understand and care/i)
    assert.match(LANDING_PAGE.howItWorks.headline, /three steps/i)
    assert.match(LANDING_PAGE.sampleReport.body, /editor-ready fix/i)
    assert.match(LANDING_PAGE.logoCloud.label, /works where you build/i)
    assert.deepEqual(HOMEPAGE_EDITOR_INTEGRATIONS.map((editor) => editor.label), [
      'Lovable',
      'Bolt',
      'Cursor',
      'Replit',
      'Claude Code',
      'Windsurf',
      'Codex',
      'Devin',
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

  it('samples SEO references the Launchpad demo, not homepage dogfood', () => {
    assert.match(SEO.samples.description, /Launchpad demo/i)
    assert.ok(!/our own homepage/i.test(SEO.samples.description))
  })
})
