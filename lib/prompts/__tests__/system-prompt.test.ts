import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  buildTriageSystemPrompt,
  buildTriageUserPrompt,
  buildTriagePrompt,
  buildPrescriptionSystemPrompt,
  buildPrescriptionUserPrompt,
  buildPrescriptionPrompt,
} from '@/lib/prompts/system-prompt'
import type { TriageContext, PrescriptionContext } from '@/lib/prompts/system-prompt'
import { flagPrescriptionSchema } from '@/lib/audit/judge-prescription-schema'

const basicTriageContext: TriageContext = {
  screenshotHint: 'desktop-and-mobile',
  url: 'https://example.com',
  pageText: 'Welcome to Example. Sign up now.',
  metadata: {
    title: 'Example',
    description: 'A fine example',
    h1s: ['Welcome'],
    ctaTexts: ['Sign up'],
    hasStructuredData: true,
    hasPrivacyPolicy: true,
    hasContactInfo: false,
  },
  scores: {
    desktopPerf: 85,
    mobilePerf: 65,
    mobileLcp: 2500,
    desktopLcp: 1800,
    cls: 0.05,
  },
  topOpportunities: [
    { id: 'img-opt', title: 'Optimize images', savings: 1500 },
  ],
  deterministicFlags: [
    {
      checkId: 'missing-alt',
      problem: 'Images missing alt text',
      evidence: '3 images have no alt attribute',
      rubric: 'experience',
      severity: 'high',
    },
  ],
}

const basicPrescriptionContext: PrescriptionContext = {
  screenshotHint: 'desktop-and-mobile',
  url: 'https://example.com',
  pageText: 'Welcome to Example. Sign up now.',
  verdict: 'Solid foundation with messaging gaps.',
  score: 72,
  metadata: {
    title: 'Example',
    description: 'A fine example',
    h1s: ['Welcome'],
    h2s: ['Features', 'Pricing'],
    ctaTexts: ['Sign up'],
  },
  techStack: ['Next.js', 'Tailwind CSS'],
  existingFlags: [
    {
      flagKey: 'flag-1',
      source: 'judge',
      rubric: 'message',
      severity: 'high',
      problem: 'Hero CTA is generic',
      checkId: null,
    },
  ],
  rubrics: [
    { name: 'MESSAGE', grade: 'C', score: 62, summary: 'Weak messaging hierarchy' },
    { name: 'EXPERIENCE', grade: 'B', score: 78, summary: 'Good but has layout gaps' },
  ],
}

describe('system-prompt triage contract', () => {
  it('preserves every supporting observation without importing rubric judgments into repair guidance', () => {
    const context: PrescriptionContext = { ...basicPrescriptionContext,
      rubrics: [{ name: 'REACH', grade: null, score: null, summary: 'No recorded grade' }],
      existingFlags: [{ ...basicPrescriptionContext.existingFlags[0], supportingObservations: [0, 1].map(index => ({
        source: 'DETERMINISTIC', checkId: 'check-' + index, checkVersion: index + 1, pageUrl: 'https://example.com/page-' + index,
        evidence: 'Original supporting evidence ' + index, recordedAt: null,
        references: [{ device: index ? 'mobile' : 'desktop', label: 'Affected control', selector: '#control-' + index }],
      })) }] }
    const prompt = buildPrescriptionUserPrompt(context)
    for (const value of ['page-0', 'page-1', 'check-0', 'check-1', 'Original supporting evidence 0', 'Original supporting evidence 1',
      'Target: desktop', 'Target: mobile', '#control-0', '#control-1']) assert.ok(prompt.includes(value), value)
    assert.doesNotMatch(prompt, /Rubric grades|REACH: Not graded/)
    assert.doesNotMatch(prompt, /REACH: F|\(0\/100\)/)
  })
  it('asks triage for evidence and whyItMatters without fix prompts', () => {
    const system = buildTriageSystemPrompt()
    assert.match(system, /evidence/i)
    assert.match(system, /whyItMatters/i)
    assert.match(system, /Do NOT write fixes/i)
  })

  it('includes rubric criteria in triage system prompt', () => {
    const system = buildTriageSystemPrompt()
    assert.match(system, /MESSAGE/)
    assert.match(system, /EXPERIENCE/)
    assert.match(system, /REACH/)
  })

  it('keeps prescription focused on fixes after triage value is visible', () => {
    const system = buildPrescriptionSystemPrompt()
    assert.match(system, /PRESCRIPTION/i)
    assert.match(system, /flag titles, evidence, and why it matters/i)
  })

  it('prescription system prompt requires scope guards', () => {
    const system = buildPrescriptionSystemPrompt()
    assert.match(system, /cannot change its classification, diagnosis, certainty, observations, evidence membership or verification obligations/i)
    assert.match(system, /Preserve unrelated working behavior/)
    assert.match(system, /Address every original supporting scope/)
  })

  it('prescription system prompt asks for a task body, not six tool dialects or invented files', () => {
    const system = buildPrescriptionSystemPrompt()
    assert.match(system, /TASK BODY/)
    assert.match(system, /Do not invent file paths/)
    assert.doesNotMatch(system, /@app\/page\.tsx/)
    assert.doesNotMatch(system, /cursorPrompt \(REQUIRED\)/)
    assert.match(system, /Do not return cursorPrompt/)
    assert.match(system, /INSPECTION PLAN/)
    assert.match(system, /keeps the existing implementation when a change is not justified/)
  })

  it('prescription user prompt includes page URL, evidence, and quoted current text', () => {
    const prompt = buildPrescriptionUserPrompt({
      ...basicPrescriptionContext,
      existingFlags: [
        {
          flagKey: 'flag-1',
          source: 'judge',
          rubric: 'message',
          severity: 'high',
          problem: 'Hero CTA is generic',
          checkId: null,
          pageUrl: 'https://example.com/pricing',
          evidence: 'The H1 reads "Welcome to Example".',
        },
      ],
    })
    assert.match(prompt, /Page: https:\/\/example\.com\/pricing/)
    assert.match(prompt, /Evidence: The H1 reads "Welcome to Example"/)
    assert.match(prompt, /Current text: "Welcome to Example"/)
  })

  it('prescription system prompt requires verification steps', () => {
    const system = buildPrescriptionSystemPrompt()
    assert.match(system, /VERIFICATION RULE/i)
    assert.match(system, /preserves the original recorded verification conditions/i)
    assert.match(system, /Do not invent traffic, revenue, abandonment, conversion/)
    assert.doesNotMatch(system, /10K|thousands of link clicks|kills the social sharing loop|10x faster/)
  })

  it('accepts agentPrompt without a URL', () => {
    const parsed = flagPrescriptionSchema.parse({
      flagKey: 'h1-generic',
      evidence: 'The H1 reads "Hi"',
      whyItMatters: 'Visitors bounce without an outcome.',
      fix: 'Name the audience and outcome in the H1.',
      agentPrompt: 'Replace the H1 with an audience-and-outcome statement.',
      cursorPrompt: null,
      claudePrompt: null,
      windsurfPrompt: null,
      lovablePrompt: null,
      boltPrompt: null,
      verificationRule: 'Reload the page and read the H1.',
    })
    assert.equal(parsed.agentPrompt?.includes('http'), false)
  })
})

describe('buildTriageUserPrompt', () => {
  it('keeps exact source membership when visible prose mentions an action absent from the CTA inventory', () => {
    const prompt = buildTriageUserPrompt({ ...basicTriageContext,
      pageText: 'View equipment. Review your pack and checkout.',
      metadata: { ...basicTriageContext.metadata, h1s: ['Equipment, "pricing"'], ctaTexts: [] } })
    const source = prompt.split('Exact source values for evidenceRefs (JSON):\n')[1].split('\n')[0]
    assert.deepEqual(JSON.parse(source), { title: ['Example'], description: ['A fine example'], headline: ['Equipment, "pricing"'], ctaText: [] })
    assert.match(prompt, /empty ctaText array does not establish that the page has no controls/)
    assert.match(prompt, /There is no minimum candidate count/)
  })
  it('renders URL, metadata, scores, and deterministic flags', () => {
    const prompt = buildTriageUserPrompt(basicTriageContext)
    assert.match(prompt, /https:\/\/example\.com/)
    assert.match(prompt, /Title: Example/)
    assert.match(prompt, /Desktop: 85\/100/)
    assert.match(prompt, /Mobile: 65\/100/)
    assert.match(prompt, /CLS: 0\.05/)
    assert.match(prompt, /missing-alt/)
    assert.match(prompt, /Optimize images/)
    assert.match(prompt, /desktop and mobile screenshots/)
  })

  it('names previous Review identities so AI Flags can match', () => {
    const prompt = buildTriageUserPrompt({
      ...basicTriageContext,
      knownObservations: [
        {
          identity: 'MESSAGE::headline is vague',
          problem: 'Headline is vague',
          rubric: 'MESSAGE',
        },
      ],
    })
    assert.match(prompt, /Known observations from the previous Review/)
    assert.match(prompt, /MESSAGE::headline is vague/)
    assert.match(prompt, /keep that problem title/)
  })

  it('handles no-screenshot hint', () => {
    const ctx: TriageContext = { ...basicTriageContext, screenshotHint: 'no-screenshot' }
    const prompt = buildTriageUserPrompt(ctx)
    assert.match(prompt, /No screenshots were available/)
    assert.doesNotMatch(prompt, /desktop and mobile screenshots/)
  })

  it('handles mobile-only screenshot hint', () => {
    const ctx: TriageContext = { ...basicTriageContext, screenshotHint: 'mobile-only' }
    const prompt = buildTriageUserPrompt(ctx)
    assert.match(prompt, /a mobile screenshot/)
  })

  it('handles null scores gracefully', () => {
    const ctx: TriageContext = {
      ...basicTriageContext,
      scores: { desktopPerf: null, mobilePerf: null, mobileLcp: null, desktopLcp: null, cls: null },
    }
    const prompt = buildTriageUserPrompt(ctx)
    assert.match(prompt, /Desktop: N\/A/)
    assert.match(prompt, /Mobile: N\/A/)
    assert.match(prompt, /CLS: N\/A/)
  })

  it('renders missing metadata fields', () => {
    const ctx: TriageContext = {
      ...basicTriageContext,
      metadata: { title: null, description: null, h1s: [], ctaTexts: [], hasStructuredData: false, hasPrivacyPolicy: undefined, hasContactInfo: undefined },
    }
    const prompt = buildTriageUserPrompt(ctx)
    assert.match(prompt, /Title: MISSING/)
    assert.match(prompt, /Description: MISSING/)
    assert.match(prompt, /H1s: NONE/)
    assert.match(prompt, /CTAs found: NONE/)
    assert.match(prompt, /Privacy policy link: UNKNOWN/)
  })

  it('renders empty deterministic flags and opportunities', () => {
    const ctx: TriageContext = {
      ...basicTriageContext,
      deterministicFlags: [],
      topOpportunities: [],
    }
    const prompt = buildTriageUserPrompt(ctx)
    assert.match(prompt, /None/)
    assert.doesNotMatch(prompt, /undefined/)
  })
})

describe('buildPrescriptionUserPrompt', () => {
  it('supplies recorded certainty and Recommendation policy without recycling prior task instructions', () => {
    const prompt = buildPrescriptionUserPrompt({ ...basicPrescriptionContext, existingFlags: [{
      ...basicPrescriptionContext.existingFlags[0], attention: 'recommendation', causeCertainty: 'OBSERVED', fixConfidence: 'LOW',
      fix: 'Review the intended visitor action before changing the existing Checkout label.',
    }] } as PrescriptionContext)
    assert.doesNotMatch(prompt, /Recorded fix:/)
    assert.doesNotMatch(prompt, /Review the intended visitor action before changing the existing Checkout label/)
    assert.match(prompt, /Attention: recommendation/)
    assert.match(prompt, /Recorded cause certainty: OBSERVED/)
    assert.match(prompt, /Recorded fix confidence: LOW/)
  })

  it('supplies recorded facts and task identities without scoring narratives', () => {
    const prompt = buildPrescriptionUserPrompt(basicPrescriptionContext)
    assert.match(prompt, /https:\/\/example\.com/)
    assert.doesNotMatch(prompt, /72\/100|Solid foundation/)
    assert.match(prompt, /Title: Example/)
    assert.match(prompt, /Next\.js/)
    assert.match(prompt, /Tailwind CSS/)
    assert.doesNotMatch(prompt, /MESSAGE: C|62\/100/)
    assert.match(prompt, /flagKey=flag-1/)
    assert.match(prompt, /desktop and mobile screenshots/)
  })

  it('handles missing tech stack', () => {
    const ctx: PrescriptionContext = { ...basicPrescriptionContext, techStack: [] }
    const prompt = buildPrescriptionUserPrompt(ctx)
    assert.doesNotMatch(prompt, /Detected tech/)
  })

  it('handles empty existing flags', () => {
    const ctx: PrescriptionContext = { ...basicPrescriptionContext, existingFlags: [] }
    const prompt = buildPrescriptionUserPrompt(ctx)
    assert.match(prompt, /None/)
  })

  it('keeps a rubric summary out of prescription facts', () => {
    const ctx: PrescriptionContext = {
      ...basicPrescriptionContext,
      rubrics: [{ name: 'REACH', grade: 'F', score: null, summary: 'Missing social proof' }],
    }
    const prompt = buildPrescriptionUserPrompt(ctx)
    assert.doesNotMatch(prompt, /REACH: F|Missing social proof/)
    assert.doesNotMatch(prompt, /null\/100/)
  })

  it('handles missing metadata fields', () => {
    const ctx: PrescriptionContext = {
      ...basicPrescriptionContext,
      metadata: { title: null, description: null, h1s: [], h2s: [], ctaTexts: [] },
    }
    const prompt = buildPrescriptionUserPrompt(ctx)
    assert.match(prompt, /Title: MISSING/)
    assert.match(prompt, /H2s: NONE/)
    assert.match(prompt, /CTAs: NONE/)
  })

  it('renders only desktop screenshot hint in single-screenshot mode', () => {
    const ctx: PrescriptionContext = { ...basicPrescriptionContext, screenshotHint: 'desktop-only' }
    const prompt = buildPrescriptionUserPrompt(ctx)
    assert.match(prompt, /a desktop screenshot/)
  })
})

describe('buildTriagePrompt (back-compat combined)', () => {
  it('includes both system and user sections', () => {
    const prompt = buildTriagePrompt(basicTriageContext)
    assert.match(prompt, /You are FixFlags/)
    assert.match(prompt, /URL: https:\/\/example\.com/)
  })
})

describe('buildPrescriptionPrompt (back-compat combined)', () => {
  it('includes both system and user sections', () => {
    const prompt = buildPrescriptionPrompt(basicPrescriptionContext)
    assert.match(prompt, /You are FixFlags/)
    assert.match(prompt, /URL: https:\/\/example\.com/)
    assert.match(prompt, /flagKey=flag-1/)
    assert.doesNotMatch(prompt, /72\/100/)
  })
})
