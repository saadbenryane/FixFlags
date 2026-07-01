import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  AI_TOOLS,
  BRAND,
  CASE_STUDIES_SECTION,
  DIFFERENTIATION,
  FINAL_CTA,
  HERO,
  HOW_IT_WORKS_SECTION,
  LANDING_PAGE,
  MCP_SECTION,
  OUTPUT_LABELS,
  PROBLEM_SECTION,
  PROOF_SECTION,
  SEGMENT_PROOF_SECTION,
  SEO,
  TRUST_STRIP,
} from '@/lib/marketing/copy'

const FORBIDDEN_TAXONOMY = /\b7 areas\b|\bseven areas\b/i

const BANNED_LANDING_PHRASES = [
  /second pass/i,
  /flag it/i,
  /ship tonight/i,
  /fix my live site/i,
  /start in 60 seconds/i,
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

const ABOVE_FOLD_COPY = [
  HERO.headline,
  HERO.headlineLine1,
  HERO.headlineLine2,
  HERO.subhead,
  HERO.audienceLine,
  ...HERO.trustBadges,
  ...TRUST_STRIP,
  PROOF_SECTION.headline,
  PROOF_SECTION.subhead,
  HOW_IT_WORKS_SECTION.subhead,
  ...HOW_IT_WORKS_SECTION.steps.map((s) => s.body),
  SEO.home.title,
  SEO.home.description,
  BRAND.tagline,
  BRAND.oneLiner,
  LANDING_PAGE.checkDimensions.headline,
  LANDING_PAGE.howItWorks.headline,
]

describe('homepage message guardrails', () => {
  it('hero headline names completion outcome after AI builds', () => {
    assert.match(HERO.headline, /finish/i)
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

  it('audience line avoids the old all-caps finish badge', () => {
    assert.ok(!/YOUR AI BUILT IT/i.test(HERO.audienceLine))
    assert.match(HERO.audienceLine, /AI-built/i)
  })

  it('hero subhead adds mechanism and deliverables, not headline echo', () => {
    assert.match(HERO.subhead, /paste a url/i)
    assert.match(HERO.subhead, /fix prompts/i)
    assert.ok(!HERO.subhead.toLowerCase().includes('finish what your ai started'))
    assert.ok(!HERO.subhead.includes(PROBLEM_SECTION.headline))
  })

  it('trust badges are short, outcome-led, not feature jargon', () => {
    assert.equal(HERO.trustBadges.length, 3)
    for (const badge of HERO.trustBadges) {
      assert.ok(badge.split(/\s+/).length <= 4, `Too long: ${badge}`)
      assert.ok(!/\bdeterministic\b/i.test(badge), `Jargon leak: ${badge}`)
      assert.ok(!/^results in/i.test(badge), `Feature-led speed claim: ${badge}`)
      assert.ok(!/^live or preview/i.test(badge), `Capability-only badge: ${badge}`)
    }
    assert.match(HERO.trustBadges[0], /users see/i)
    assert.match(HERO.trustBadges[1], /fix prompts/i)
    assert.match(HERO.trustBadges[2], /free scan/i)
  })

  it('AI tools named once in segment proof, not repeated in hero', () => {
    assert.ok(!HERO.subhead.includes(AI_TOOLS.split(',')[0]))
    assert.ok(SEGMENT_PROOF_SECTION.tiles.some((t) => t.proof.includes('Cursor')))
  })

  it('SEGMENT_PROOF has shipper and live-site tiles', () => {
    const ids = SEGMENT_PROOF_SECTION.tiles.map((t) => t.id)
    assert.deepEqual(ids, ['ai-shipper', 'live-site'])
  })

  it('OUTPUT_LABELS fix prompt label and next step are defined', () => {
    assert.equal(OUTPUT_LABELS.fixPrompt, 'Fix prompt (copy-ready)')
    assert.equal(OUTPUT_LABELS.nextStep, 'Paste into editor → run → re-check.')
  })

  it('sample output section uses merged label', () => {
    assert.equal(OUTPUT_LABELS.whatYouGet, 'Sample output')
    assert.equal(PROOF_SECTION.label, OUTPUT_LABELS.whatYouGet)
  })

  it('problem section uses review-focused label and fix prompt tie-backs', () => {
    assert.equal(PROBLEM_SECTION.label, 'Why you miss this in reviews')
    for (const pain of PROBLEM_SECTION.pains) {
      assert.ok('fixPrompt' in pain && pain.fixPrompt.length > 0)
    }
  })

  it('agent workflow has intro and closing lines', () => {
    assert.ok(MCP_SECTION.intro.length > 0)
    assert.ok(MCP_SECTION.closing.length > 0)
  })

  it('primary CTA is a delivery promise', () => {
    assert.equal(HERO.primaryCta, 'Show fixes')
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

  it('how-it-works and case studies avoid duplicate before/after phrasing', () => {
    assert.ok(!HOW_IT_WORKS_SECTION.subhead.toLowerCase().includes('before/after'))
    assert.ok(!CASE_STUDIES_SECTION.headline.toLowerCase().includes('before/after'))
  })

  it('segment proof avoids "Graded" marketing copy', () => {
    for (const tile of SEGMENT_PROOF_SECTION.tiles) {
      assert.ok(!/\bgraded\b/i.test(tile.proof), `Graded leak: ${tile.proof}`)
    }
  })

  it('landing marketing strings avoid banned insider phrases', () => {
    for (const line of LANDING_MARKETING_STRINGS) {
      for (const pattern of BANNED_LANDING_PHRASES) {
        assert.ok(!pattern.test(line), `Banned phrase (${pattern}) in: ${line}`)
      }
    }
  })

  it('how it works section has loop copy without problem bar jargon', () => {
    assert.ok(!('problemBar' in LANDING_PAGE.howItWorks))
    assert.match(LANDING_PAGE.howItWorks.headline, /one loop/i)
    assert.ok(LANDING_PAGE.howItWorks.subhead.length > 0)
    assert.match(LANDING_PAGE.howItWorks.sampleLink, /sample review/i)
  })

  it('flag step avoids unverifiable flag counts in preview', () => {
    const flag = LANDING_PAGE.howItWorks.steps.find((s) => s.title === 'Flag')
    assert.ok(flag)
    assert.ok(!/\b\d+\b/.test(flag!.preview))
  })

  it('verify step avoids synthetic score delta in preview', () => {
    const verify = LANDING_PAGE.howItWorks.steps.find((s) => s.title === 'Verify')
    assert.ok(verify)
    assert.ok(!verify!.preview.includes('+32%'))
    assert.ok(!verify!.preview.toLowerCase().includes('score improved'))
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

  it('testimonials avoid second-pass framing', () => {
    assert.match(LANDING_PAGE.testimonials.headline, /example feedback/i)
    assert.ok(!/second pass/i.test(LANDING_PAGE.testimonials.headline))
    for (const quote of LANDING_PAGE.testimonials.quotes) {
      assert.ok(!/second pass/i.test(quote.quote))
    }
  })

  it('landing page exposes three-rubric check story', () => {
    assert.match(LANDING_PAGE.checkDimensions.cards[0].question, /understand and care/i)
    assert.match(LANDING_PAGE.howItWorks.headline, /one loop/i)
    assert.match(LANDING_PAGE.sampleReport.body, /No noise/i)
    assert.deepEqual([...LANDING_PAGE.logoCloud.logos], [
      'Cursor',
      'Codex',
      'Lovable',
      'Bolt',
      'Claude Code',
      'Windsurf',
    ])
    assert.ok(LANDING_PAGE.logoCloud.disclaimer.length > 0)
    assert.ok(!LANDING_PAGE.testimonials.disclaimer.includes('2,000'))
    assert.ok(LANDING_PAGE.testimonials.quotes.length >= 4)
  })

  it('samples SEO references LaunchPad demo, not homepage dogfood', () => {
    assert.match(SEO.samples.description, /LaunchPad demo/i)
    assert.ok(!/our own homepage/i.test(SEO.samples.description))
  })
})
