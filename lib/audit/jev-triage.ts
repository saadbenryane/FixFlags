import { callJev, isJevConfigured, type JevQuestion, type JevAnswer } from './jev-client'
import { buildTriageContext, type TriageContext } from '../prompts/system-prompt'
import { PageMetadata } from './metadata'
import { PageSpeedResult } from './pagespeed'
import { DeterministicFlag } from './checks'
import { detectPagePurpose } from './page-purpose'
import { RUBRIC_ORDER } from './constants'
import type { TriageOutput } from './judge-triage-schema'

export interface JevTriageResult {
  output: TriageOutput
  usage: {
    inputTokens: number
    outputTokens: number
    model: string
    costUsd: number
  }
  rawJevAnswers: Record<string, JevAnswer>
}

function buildJevTriageQuestions(): Record<string, JevQuestion> {
  return {
    // Page classification
    pageType: {
      type: 'choice',
      instructions: 'What type of page is this? Choose the single best match.',
      criteria: {
        homepage: 'Main entry point, broad overview',
        pricing: 'Pricing plans, tiers, feature comparison',
        landing: 'Campaign-specific conversion page',
        dashboard: 'Logged-in app dashboard',
        portfolio: 'Showcase of work/projects',
        article: 'Blog post, documentation, guide',
        other: 'None of the above',
      },
    },

    // Rubric scores (0-100)
    messageScore: {
      type: 'score',
      instructions: 'Rate the MESSAGE dimension: Does the page make the visitor feel understood and compelled to act? Consider: hero clarity, audience specificity, outcome focus, CTA quality, social proof, hierarchy of value.',
      criteria: [
        'Fails completely - no clear message or audience',
        'Weak - vague audience, generic value prop',
        'Below average - some clarity but major gaps',
        'Average - clear enough but not compelling',
        'Above average - good audience signal, clear value',
        'Strong - specific audience, compelling outcome, good CTAs',
        'Excellent - sharp message, perfect audience-outcome fit',
        'Outstanding - best-in-class messaging, zero fluff',
        'Exceptional - could teach a masterclass on messaging',
        'Perfect - flawless message-audience alignment',
      ],
    },

    experienceScore: {
      type: 'score',
      instructions: 'Rate the EXPERIENCE dimension: Does the page feel professional, trustworthy, and easy to use? Consider: 5-second glance test, mobile layout, visual hierarchy, perceived speed, alignment/spacing, visual quality.',
      criteria: [
        'Broken - unusable, major layout failures',
        'Very poor - looks unprofessional, confusing',
        'Poor - significant visual/UX issues',
        'Below average - noticeable friction, amateur feel',
        'Average - functional but not polished',
        'Above average - clean, mostly professional',
        'Good - solid visual hierarchy, trustworthy',
        'Very good - polished, smooth mobile experience',
        'Excellent - delightful, best-in-class UX',
        'Perfect - flawless experience',
      ],
    },

    reachScore: {
      type: 'score',
      instructions: 'Rate the REACH dimension: Can the right people find, share, and trust this page? Consider: social preview, SEO fundamentals, completeness, trust signals, shareability.',
      criteria: [
        'Invisible - no SEO, no social, incomplete',
        'Very poor - missing fundamentals',
        'Poor - major gaps in discoverability',
        'Below average - some basics, weak sharing',
        'Average - competent basics',
        'Above average - good SEO, decent social',
        'Good - strong fundamentals, shareable',
        'Very good - excellent SEO, great social cards',
        'Excellent - optimized for discovery and trust',
        'Perfect - maximum reach potential',
      ],
    },

    // Launch checklist (5 binary gates)
    hasHttps: {
      type: 'noul',
      instructions: 'Does the page load over HTTPS with a valid certificate?',
    },
    hasSocialPreview: {
      type: 'noul',
      instructions: 'Does the page have valid Open Graph tags (og:title, og:description, og:image) that would render a proper social card?',
    },
    hasMobileCta: {
      type: 'noul',
      instructions: 'Is the primary CTA visible and tappable on a 375px mobile viewport without scrolling past the first screen?',
    },
    hasNoConsoleErrors: {
      type: 'noul',
      instructions: 'Are there zero JavaScript console errors on page load?',
    },
    hasPrivacyContact: {
      type: 'noul',
      instructions: 'Does the page have both a privacy policy link and contact information in the footer or header?',
    },

    // Overall verdict bucket
    launchReadiness: {
      type: 'choice',
      instructions: 'Based on all evidence, is this page safe to share publicly?',
      criteria: {
        safe: 'Ship it - no blockers',
        fix_first: 'Fix top issues first, then ship',
        not_ready: 'Do not post yet - major problems',
      },
    },

    // Overall score (0-100)
    overallScore: {
      type: 'score',
      instructions: 'Overall quality score 0-100 combining message, experience, and reach.',
      criteria: [
        '0-10: Fundamentally broken',
        '11-20: Severe issues throughout',
        '21-30: Major problems',
        '31-40: Significant gaps',
        '41-50: Below average',
        '51-60: Average',
        '61-70: Above average',
        '71-80: Good',
        '81-90: Very good',
        '91-100: Excellent',
      ],
    },
  }
}

function mapJevAnswersToTriage(
  answers: Record<string, JevAnswer>,
  context: TriageContext,
  flags: DeterministicFlag[]
): TriageOutput {
  const pageTypeAnswer = answers.pageType as JevAnswerChoice
  const messageScoreAnswer = answers.messageScore as JevAnswerScore
  const experienceScoreAnswer = answers.experienceScore as JevAnswerScore
  const reachScoreAnswer = answers.reachScore as JevAnswerScore
  const overallScoreAnswer = answers.overallScore as JevAnswerScore
  const launchReadinessAnswer = answers.launchReadiness as JevAnswerChoice

  const httpsAnswer = answers.hasHttps as JevAnswerNoul
  const socialPreviewAnswer = answers.hasSocialPreview as JevAnswerNoul
  const mobileCtaAnswer = answers.hasMobileCta as JevAnswerNoul
  const consoleErrorsAnswer = answers.hasNoConsoleErrors as JevAnswerNoul
  const privacyContactAnswer = answers.hasPrivacyContact as JevAnswerNoul

  const score = Math.round(overallScoreAnswer.score)
  const messageScore = Math.round(messageScoreAnswer.score)
  const experienceScore = Math.round(experienceScoreAnswer.score)
  const reachScore = Math.round(reachScoreAnswer.score)

  // Map scores to grades
  function scoreToGrade(s: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (s >= 90) return 'A'
    if (s >= 75) return 'B'
    if (s >= 60) return 'C'
    if (s >= 40) return 'D'
    return 'F'
  }

  function scoreToStatus(s: number): 'EXCELLENT' | 'GOOD' | 'NEEDS_WORK' | 'CRITICAL' {
    if (s >= 90) return 'EXCELLENT'
    if (s >= 75) return 'GOOD'
    if (s >= 60) return 'NEEDS_WORK'
    return 'CRITICAL'
  }

  // Determine assessment state based on screenshot availability
  const hasVisuals = context.screenshotHint !== 'no-screenshot'
  const visualState = hasVisuals ? 'ASSESSED' : 'PARTIAL' as const

  const rubrics = RUBRIC_ORDER.map((name) => {
    const s = name === 'MESSAGE' ? messageScore : name === 'EXPERIENCE' ? experienceScore : reachScore
    const conf = name === 'MESSAGE' ? messageScoreAnswer.confidence
      : name === 'EXPERIENCE' ? experienceScoreAnswer.confidence
      : reachScoreAnswer.confidence

    return {
      name,
      score: visualState === 'ASSESSED' ? s : null,
      grade: scoreToGrade(s),
      status: scoreToStatus(s),
      assessmentState: visualState,
      confidence: conf,
      summary: `${name} score: ${s}/100. ${conf > 0.8 ? 'High confidence.' : conf > 0.5 ? 'Moderate confidence.' : 'Low confidence - limited evidence.'}`,
      rubricPrompt: '',
      cursorPrompt: null,
      claudePrompt: null,
      windsurfPrompt: null,
      lovablePrompt: null,
      boltPrompt: null,
    }
  })

  const launchChecklist = [
    { id: 'https' as const, label: 'HTTPS', passed: httpsAnswer.noul > 0.5 },
    { id: 'social-preview' as const, label: 'Social Preview', passed: socialPreviewAnswer.noul > 0.5 },
    { id: 'mobile-cta' as const, label: 'Mobile CTA Visible', passed: mobileCtaAnswer.noul > 0.5 },
    { id: 'console-errors' as const, label: 'No Console Errors', passed: consoleErrorsAnswer.noul > 0.5 },
    { id: 'privacy-contact' as const, label: 'Privacy & Contact', passed: privacyContactAnswer.noul > 0.5 },
  ]

  const launchReadiness = launchReadinessAnswer.choice as 'safe' | 'fix_first' | 'not_ready'

  // Generate verdict from scores
  const verdict = `Overall ${score}/100. ${launchReadiness === 'safe' ? 'Ready to ship.' : launchReadiness === 'fix_first' ? 'Fix top issues first.' : 'Not ready - major problems.'}`

  // For now, no new AI flags - we focus on deterministic flags only
  // This keeps JEV triage fast and cheap; AI flags can be added later
  const newFlags: TriageOutput['newFlags'] = []

  return {
    pageJob: context.pagePurpose?.purpose === 'marketing' ? 'Convert visitors into customers' : 'Inform and engage visitors',
    pageType: pageTypeAnswer.choice as TriageOutput['pageType'],
    verdict,
    score,
    launchReadiness,
    launchChecklist,
    rubrics,
    newFlags,
    enrichments: [],
  }
}

export async function runJevTriage(
  url: string,
  metadata: PageMetadata,
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null,
  flags: DeterministicFlag[],
  _desktopBase64: string | null,
  _mobileBase64: string | null,
  _maxTimeoutMs?: number,
  _knownObservations?: TriageContext['knownObservations']
): Promise<JevTriageResult> {
  if (!isJevConfigured()) {
    throw new Error('JEV not configured - missing TYPESAFE_API_KEY')
  }

  const context = buildTriageContext(url, metadata, desktop, mobile, flags)
  const questions = buildJevTriageQuestions()

  // Build state for JEV - combine all relevant context
  const state = {
    url,
    pageText: context.pageText.slice(0, 8000),
    metadata: context.metadata,
    scores: context.scores,
    deterministicFlags: context.deterministicFlags.map(f => ({
      checkId: f.checkId,
      problem: f.problem,
      rubric: f.rubric,
      severity: f.severity,
    })),
    pagePurpose: context.pagePurpose,
  }

  const response = await callJev({
    state,
    questions,
  })

  const output = mapJevAnswersToTriage(response.answers, context, flags)

  return {
    output,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: 0, // JEV output is free
      model: response.model,
      costUsd: response.usage.cost_usd,
    },
    rawJevAnswers: response.answers,
  }
}

export function isJevTriageAvailable(): boolean {
  return isJevConfigured()
}