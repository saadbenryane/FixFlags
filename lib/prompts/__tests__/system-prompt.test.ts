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
    assert.match(system, /Do NOT change/i)
    assert.match(system, /SCOPE/i)
  })

  it('prescription system prompt requires verification steps', () => {
    const system = buildPrescriptionSystemPrompt()
    assert.match(system, /VERIFICATION RULE/i)
    assert.match(system, /Reload the page/i)
  })
})

describe('buildTriageUserPrompt', () => {
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
  it('renders URL, score, verdict, metadata, tech stack, rubrics, and flags', () => {
    const prompt = buildPrescriptionUserPrompt(basicPrescriptionContext)
    assert.match(prompt, /https:\/\/example\.com/)
    assert.match(prompt, /72\/100/)
    assert.match(prompt, /Solid foundation/)
    assert.match(prompt, /Title: Example/)
    assert.match(prompt, /Next\.js/)
    assert.match(prompt, /Tailwind CSS/)
    assert.match(prompt, /MESSAGE: C/)
    assert.match(prompt, /62\/100/)
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

  it('handles null rubric scores', () => {
    const ctx: PrescriptionContext = {
      ...basicPrescriptionContext,
      rubrics: [{ name: 'REACH', grade: 'F', score: null, summary: 'Missing social proof' }],
    }
    const prompt = buildPrescriptionUserPrompt(ctx)
    assert.match(prompt, /REACH: F/)
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
    assert.match(prompt, /72\/100/)
  })
})
