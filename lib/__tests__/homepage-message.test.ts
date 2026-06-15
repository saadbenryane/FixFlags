import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  AI_TOOLS,
  BRAND,
  CASE_STUDIES_SECTION,
  DIFFERENTIATION,
  HERO,
  HOW_IT_WORKS_SECTION,
  MCP_SECTION,
  OUTPUT_LABELS,
  PROBLEM_SECTION,
  PROOF_SECTION,
  SEGMENT_PROOF_SECTION,
  SEO,
  TRUST_STRIP,
} from '@/lib/marketing/copy'

const FORBIDDEN_TAXONOMY = /\b7 areas\b|\bseven areas\b/i

const ABOVE_FOLD_COPY = [
  HERO.headline,
  HERO.headlineLine1,
  HERO.headlineLine2,
  HERO.subhead,
  HERO.audienceLine,
  HERO.trustLine,
  ...TRUST_STRIP,
  PROOF_SECTION.headline,
  PROOF_SECTION.subhead,
  HOW_IT_WORKS_SECTION.subhead,
  ...HOW_IT_WORKS_SECTION.steps.map((s) => s.body),
  SEO.home.title,
  SEO.home.description,
  BRAND.tagline,
  BRAND.oneLiner,
]

describe('homepage message guardrails', () => {
  it('hero headline is one clear outcome (≤4 words per line)', () => {
    assert.ok(HERO.headlineLine1.split(/\s+/).length <= 4)
    assert.ok(HERO.headlineLine2.split(/\s+/).length <= 4)
    assert.equal(HERO.headline, `${HERO.headlineLine1} ${HERO.headlineLine2}`)
  })

  it('above-fold copy avoids internal "7 areas" taxonomy', () => {
    for (const line of ABOVE_FOLD_COPY) {
      assert.ok(!FORBIDDEN_TAXONOMY.test(line), `Taxonomy leak: ${line}`)
    }
  })

  it('audience line names a single tight audience', () => {
    assert.match(HERO.audienceLine, /shipping weekly/i)
    assert.ok(!/live sites/i.test(HERO.audienceLine))
  })

  it('hero subhead adds mechanism and deliverables, not headline echo', () => {
    assert.match(HERO.subhead, /paste a url/i)
    assert.match(HERO.subhead, /screenshots/i)
    assert.ok(!HERO.subhead.toLowerCase().includes(HERO.headlineLine1.toLowerCase()))
    assert.ok(!HERO.subhead.includes(PROBLEM_SECTION.headline))
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
    assert.equal(HERO.primaryCta, 'Get my report')
    assert.equal(PROOF_SECTION.cta, 'Get my report')
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
})
