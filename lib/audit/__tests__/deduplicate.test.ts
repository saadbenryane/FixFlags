import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { deduplicateFlags, deduplicateTriageFlags } from '@/lib/audit/deduplicate'
import type { DeterministicFlag } from '@/lib/audit/checks'
import type { TriageOutput } from '@/lib/audit/judge-triage-schema'
import { validateTriageOutput } from '@/lib/audit/validate-triage-output'

function det(partial: Partial<DeterministicFlag> & Pick<DeterministicFlag, 'checkId' | 'problem'>): DeterministicFlag {
  return {
    rubric: 'REACH',
    impactTag: null,
    severity: 'IMPORTANT',
    evidence: partial.evidence ?? partial.problem,
    fix: 'Fix it',
    confidence: 1,
    source: 'DETERMINISTIC',
    ...partial,
  }
}

describe('deduplicateFlags', () => {
  it('drops AI flags that paraphrase deterministic REACH metadata issues', () => {
    const deterministic = [
      det({
        checkId: 'og-image-missing',
        rubric: 'REACH',
        problem: 'og:image is missing, link previews show blank',
      }),
    ]
    const aiFlags = [
      {
        rubric: 'REACH' as const,
        impactTag: 'SHARING' as const,
        severity: 'CRITICAL' as const,
        problem: 'The page lacks an og:image, making social shares appear bland',
        evidence: 'No og:image meta tag in page head',
        whyItMatters: 'Shared links show blank preview cards',
        fix: 'Add og:image',
        confidence: 0.9,
        verificationRule: 'Twitter Card Validator shows image',
      },
    ]

    assert.equal(deduplicateFlags(deterministic, aiFlags).length, 0)
  })

  it('drops cross-rubric AI flags that match mobile CTA deterministic theme', () => {
    const deterministic = [
      det({
        checkId: 'cta-below-fold-mobile',
        rubric: 'EXPERIENCE',
        problem: 'Primary CTA is hidden below the fold on mobile',
        evidence: 'Mobile 812px viewport: Get started starts at 720px',
      }),
    ]
    const aiFlags = [
      {
        rubric: 'MESSAGE' as const,
        impactTag: 'CONVERSION' as const,
        severity: 'IMPORTANT' as const,
        problem: 'Hero CTA is not visible without scrolling on mobile',
        evidence: 'Mobile screenshot shows CTA below first screen',
        whyItMatters: 'Mobile visitors may miss the signup action',
        fix: 'Move CTA above fold',
        confidence: 0.85,
        verificationRule: '375x812: CTA visible without scroll',
      },
    ]

    assert.equal(deduplicateFlags(deterministic, aiFlags).length, 0)
  })

  it('drops an AI audience-specificity paraphrase of the deterministic headline flag', () => {
    const deterministic = [
      det({
        checkId: 'messaging-no-audience',
        rubric: 'MESSAGE',
        problem: 'Headline does not specify who this is for',
        evidence: 'H1: "From vision to reality." has no audience signal.',
      }),
    ]
    const aiFlags = [
      {
        rubric: 'MESSAGE' as const,
        impactTag: 'CLARITY' as const,
        severity: 'IMPORTANT' as const,
        problem: 'Headline lacks audience specificity',
        evidence: 'The headline does not specify who this service is for.',
        whyItMatters: 'Visitors may not recognize themselves.',
        fix: 'Name the audience.',
        confidence: 0.75,
        verificationRule: 'The headline names the intended audience.',
      },
    ]

    assert.equal(deduplicateFlags(deterministic, aiFlags).length, 0)
  })

  it('rejects AI mobile CTA geometry claims when the deterministic check correctly passes', () => {
    const aiFlags = [
      {
        rubric: 'EXPERIENCE' as const,
        impactTag: 'CONVERSION' as const,
        severity: 'IMPORTANT' as const,
        problem: 'Primary CTA is not prominent on mobile',
        evidence: 'The Book a Call CTA is somewhat hidden within the mobile layout.',
        whyItMatters: 'Mobile visitors may miss it.',
        fix: 'Move the CTA.',
        confidence: 0.75,
        verificationRule: 'Check the mobile viewport.',
      },
    ]

    assert.equal(deduplicateFlags([], aiFlags).length, 0)
  })

  it('rejects AI absence claims for privacy and contact facts owned by deterministic metadata', () => {
    const aiFlags = [
      {
        rubric: 'REACH' as const,
        impactTag: 'TRUST' as const,
        severity: 'CRITICAL' as const,
        problem: 'Missing privacy policy and contact information',
        evidence: 'There is no link to a privacy policy or easy access to contact information.',
        whyItMatters: 'Visitors may hesitate.',
        fix: 'Add both.',
        confidence: 0.75,
        verificationRule: 'Check the footer.',
      },
    ]

    assert.equal(deduplicateFlags([], aiFlags).length, 0)
  })

  it('drops the exact triage paraphrases reproduced by placeholder dogfood', () => {
    const deterministic = [
      det({ checkId: 'no-privacy-policy', problem: 'No privacy policy link found' }),
      det({
        checkId: 'mobile-cta-weak-label',
        rubric: 'MESSAGE',
        problem: 'Mobile CTA label "Learn more" is vague',
      }),
      det({
        checkId: 'trust-no-internal-links',
        rubric: 'EXPERIENCE',
        problem: 'Page has very few internal navigation links',
      }),
    ]
    const aiFlags = [
      {
        rubric: 'REACH' as const,
        impactTag: 'TRUST' as const,
        severity: 'CRITICAL' as const,
        problem: 'Lack of privacy policy and contact information diminishes trust',
        evidence: 'The page is missing both a privacy policy and contact information.',
        whyItMatters: 'Visitors may not trust the site.',
        confidence: 0.95,
        pageUrl: null,
      },
      {
        rubric: 'MESSAGE' as const,
        impactTag: 'CONVERSION' as const,
        severity: 'CRITICAL' as const,
        problem: 'Vague CTA text undermines user engagement',
        evidence: 'The mobile CTA label is simply Learn more, which is too ambiguous.',
        whyItMatters: 'Visitors may not act.',
        confidence: 0.95,
        pageUrl: null,
      },
      {
        rubric: 'EXPERIENCE' as const,
        impactTag: 'FRICTION' as const,
        severity: 'IMPORTANT' as const,
        problem: 'Insufficient internal navigation creates usability issues',
        evidence: 'The page has very few internal navigation links.',
        whyItMatters: 'People cannot explore further.',
        confidence: 0.9,
        pageUrl: null,
      },
    ]

    assert.equal(deduplicateTriageFlags(deterministic, aiFlags).length, 0)
  })

  it('rejects AI cookie-consent findings owned by deterministic metadata', () => {
    const aiFlags = [
      {
        rubric: 'REACH' as const,
        impactTag: 'TRUST' as const,
        severity: 'IMPORTANT' as const,
        problem: 'No cookie consent mechanism in place',
        evidence: 'Analytics is present but no cookie banner is found.',
        whyItMatters: 'Consent requirements may apply.',
        fix: 'Add consent controls.',
        confidence: 0.8,
        verificationRule: 'Confirm analytics waits for consent.',
      },
    ]

    assert.equal(deduplicateFlags([], aiFlags).length, 0)
  })

  it('rejects AI console and share-control claims owned by deterministic checks', () => {
    const aiFlags = [
      {
        rubric: 'EXPERIENCE' as const,
        impactTag: 'TRUST' as const,
        severity: 'IMPORTANT' as const,
        problem: 'Presence of console errors',
        evidence: 'Console errors appear during inspection.',
        whyItMatters: 'Errors may indicate broken behavior.',
        fix: 'Fix errors.',
        confidence: 0.7,
        verificationRule: 'Open the console.',
      },
      {
        rubric: 'REACH' as const,
        impactTag: 'SHARING' as const,
        severity: 'POLISH' as const,
        problem: 'No social sharing options',
        evidence: 'There are no visible ways to share or promote the site further.',
        whyItMatters: 'Visitors cannot promote the site.',
        fix: 'Add share buttons.',
        confidence: 0.7,
        verificationRule: 'Find a share button.',
      },
    ]

    assert.equal(deduplicateFlags([], aiFlags).length, 0)
  })

  it('keeps genuinely new AI flags', () => {
    const deterministic = [
      det({
        checkId: 'title-too-short',
        rubric: 'REACH',
        problem: 'Page title is too short',
      }),
    ]
    const aiFlags = [
      {
        rubric: 'MESSAGE' as const,
        impactTag: 'TRUST' as const,
        severity: 'IMPORTANT' as const,
        problem: 'Testimonials section uses placeholder company names',
        evidence: 'Screenshot shows "Acme Corp" repeated three times',
        whyItMatters: 'Fake social proof erodes trust',
        fix: 'Replace with real customer names or remove section',
        confidence: 0.8,
        verificationRule: 'No placeholder company names remain on page',
      },
    ]

    assert.equal(deduplicateFlags(deterministic, aiFlags).length, 1)
  })
})

type TriageFlag = TriageOutput['newFlags'][number]

function ai(partial: Partial<TriageFlag> = {}): TriageFlag {
  return {
    reviewKind: 'copy-clarity', evidenceRefs: [{ source: 'headline', quote: 'Build something better' }], device: 'none',
    rubric: 'MESSAGE', impactTag: 'CLARITY', severity: 'IMPORTANT',
    problem: 'Headline lacks audience specificity',
    evidence: 'The headline "Build something better" does not identify its intended audience.',
    whyItMatters: 'Visitors need to recognize whether the offer is relevant.',
    confidence: 0.8, pageUrl: null, ...partial,
  }
}

const root = 'https://example.com/'
const pricing = 'https://example.com/pricing'
const deduplicators = [
  ['triage', deduplicateTriageFlags],
  ['judge', (deterministic: DeterministicFlag[], flags: TriageFlag[], primaryPageUrl?: string) =>
    deduplicateFlags(deterministic, flags.map(flag => ({ ...flag, pageUrl: flag.pageUrl ?? undefined, fix: 'Clarify the offer' })), primaryPageUrl)],
] as const

for (const [name, deduplicate] of deduplicators) {
  describe(`${name} deduplication scope`, () => {
    it('keeps a headline finding when its deterministic counterpart is on another page', () => {
      const deterministic = [det({ checkId: 'messaging-no-audience', problem: 'Headline lacks audience specificity', evidence: 'Recorded H1: Build something better', pageUrl: root })]
      assert.equal(deduplicate(deterministic, [ai({ pageUrl: pricing })]).length, 1)
      assert.equal(deduplicate(deterministic, [ai({ pageUrl: root })]).length, 0)
    })

    it('keeps near-identical AI observations on distinct pages', () => {
      assert.equal(deduplicate([], [ai({ pageUrl: root }), ai({ pageUrl: pricing })]).length, 2)
      assert.equal(deduplicate([], [ai({ pageUrl: root }), ai({ pageUrl: root })]).length, 1)
    })

    it('uses affected paths when matching a collapsed deterministic finding', () => {
      const deterministic = [det({ checkId: 'messaging-no-audience', problem: 'Headline lacks audience specificity',
        pageUrl: root, affectedPaths: [root, pricing] })]
      assert.equal(deduplicate(deterministic, [ai({ pageUrl: pricing })]).length, 0)
    })

    it('resolves null page URLs to the supplied primary page without hiding other pages', () => {
      const deterministic = [det({ checkId: 'messaging-no-audience', problem: 'Headline lacks audience specificity', evidence: 'Recorded H1: Build something better', pageUrl: root })]
      assert.equal(deduplicate(deterministic, [ai()], root).length, 0)
      assert.equal(deduplicate(deterministic, [ai()], pricing).length, 1)
      assert.equal(deduplicate([], [ai(), ai({ pageUrl: root })], root).length, 1)
    })

    it('keeps unknown scopes separate from explicit pages when no primary page is known', () => {
      const deterministic = [det({ checkId: 'messaging-no-audience', problem: 'Headline lacks audience specificity' })]
      assert.equal(deduplicate(deterministic, [ai({ pageUrl: pricing })]).length, 1)
      assert.equal(deduplicate([], [ai(), ai({ pageUrl: pricing })]).length, 2)
    })

    it('keeps independent fragment states and query variants outside another page ownership claim', () => {
      const deterministic = [det({ checkId: 'messaging-no-audience', problem: 'Headline lacks audience specificity', evidence: 'Recorded H1: Build something better', pageUrl: root })]
      assert.equal(deduplicate(deterministic, [ai({ pageUrl: root + '#hero' })]).length, 1)
      assert.equal(deduplicate(deterministic, [ai({ pageUrl: root + '?variant=b' })]).length, 1)
    })

    it('retains a specific CTA promise mismatch instead of treating every primary CTA mention as geometry', () => {
      const mismatch = ai({ problem: 'Primary CTA promises instant access but leads to a sales request',
        evidence: 'The primary CTA says "Start now" but its destination asks visitors to book a demo.' })
      assert.equal(deduplicate([], [mismatch]).length, 1)
    })

    it('still rejects unsupported geometry claims without a deterministic failure', () => {
      assert.equal(deduplicate([], [ai({ rubric: 'EXPERIENCE', problem: 'Primary CTA is hidden below the fold on mobile' })]).length, 0)
    })
  })
}

function triageOutput(newFlags: TriageFlag[]): TriageOutput {
  return {
    pageJob: 'Explain the offer', pageType: 'homepage', verdict: 'Review the headline', score: 70,
    launchReadiness: 'fix_first',
    launchChecklist: (['https', 'social-preview', 'mobile-cta', 'console-errors', 'privacy-contact'] as const)
      .map(id => ({ id, label: id, passed: true })),
    rubrics: (['MESSAGE', 'EXPERIENCE', 'REACH'] as const).map(name => ({ name, score: 70,
      grade: 'C', status: 'NEEDS_WORK', assessmentState: 'ASSESSED', confidence: 0.8, summary: 'Captured page evidence' })),
    newFlags,
  }
}

const context = { url: root, pageText: 'Build something better',
  metadata: { title: null, description: null, h1s: ['Build something better'], ctaTexts: [], hasStructuredData: false } }

it('passes the reviewed page from triage validation into deduplication', () => {
  const output = triageOutput([ai()])
  const deterministic = [det({ checkId: 'messaging-no-audience', problem: 'Headline lacks audience specificity', evidence: 'Recorded H1: Build something better', pageUrl: root })]
  assert.equal(validateTriageOutput(output, deterministic, 'unknown', context).newFlags.length, 0)
  assert.equal(validateTriageOutput(output, deterministic, 'unknown', { ...context, url: pricing }).newFlags.length, 1)
})

it('does not let an unsupported AI observation suppress a later source-backed finding', () => {
  const supported = ai()
  const unsupported = ai({ evidenceRefs: [{ source: 'headline', quote: 'Guaranteed results for everybody' }], evidence: 'The headline says "Guaranteed results for everybody".' })
  for (const newFlags of [[unsupported, supported], [supported, unsupported]]) {
    const result = validateTriageOutput(triageOutput(newFlags), [], 'unknown', context).newFlags
    assert.equal(result.length, 1)
    assert.match(result[0]!.problem, /^Review/)
    assert.match(result[0]!.evidence, /Build something better/)
    assert.doesNotMatch(result[0]!.evidence, /Guaranteed results/)
  }
})

it('retains distinct supporting evidence without inferring equivalence from an AI title', () => {
  const headline = ai({ pageUrl: root })
  const subheading = ai({ pageUrl: root, evidence: 'The subheading "Make progress today" also leaves the audience unspecified.' })
  const flags = [headline, subheading, { ...subheading }]
  const before = structuredClone(flags)
  const result = deduplicateTriageFlags([], flags)
  assert.equal(result.length, 2)
  assert.equal(result[0].evidence, headline.evidence)
  assert.equal(result[1].evidence, subheading.evidence)
  assert.deepEqual(flags, before)
  assert.equal(deduplicateTriageFlags([], [headline, { ...subheading, pageUrl: pricing }]).length, 2)
})
