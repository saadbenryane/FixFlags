/**
 * JEV validation harness: does the System One judge beat the LLM judge on our
 * own accuracy corpus, at acceptable cost and latency?
 *
 *   TYPESAFE_API_KEY=... npm run jev:validate
 *   TYPESAFE_API_KEY=... npm run jev:validate -- --fixture nextjs-org.html
 *   TYPESAFE_API_KEY=... npm run jev:validate -- --repeat 3   # calibration run
 *
 * This is a research gate, not production wiring. Nothing here is imported by
 * the audit pipeline. It answers one question: should we replace or add to the
 * LLM judge?
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { ACCURACY_FIXTURE_DIR, accuracyGateFixtures, type AccuracyHtmlFixture } from '@/lib/audit/accuracy-corpus'
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { runAccuracyFixtureChecks } from '@/lib/audit/fixture-html'
/**
 * NOTE: this harness is deliberately self-contained. It talks to the JEV
 * /systemone endpoint through the shared `jev-client` transport, but owns its
 * own question set, score mapping and triage conversion.
 *
 * It does NOT import `lib/audit/jev-triage.ts`. That adapter is an in-flight
 * experiment owned by another agent (check `npm run agent -- ownership`,
 * restore-ci-triage-adapter-2026-09-29) and currently does not typecheck.
 * Coupling this research gate to unreferenced experiment code would inherit
 * that breakage and blur whose scope is whose.
 */
import { isJevConfigured, callJev, type JevAnswer, type JevQuestion } from '@/lib/audit/jev-client'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { gradeFromScore } from '@/lib/audit/scoring'
import { GRADE_THRESHOLDS } from '@/lib/audit/rubric'
import { detectPagePurpose } from '@/lib/audit/page-purpose'
import type { TriageOutput } from '@/lib/audit/judge-triage-schema'

const args = process.argv.slice(2)
function flag(name: string): string | null {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? (args[i + 1] ?? null) : null
}
const only = flag('fixture')
const repeat = Math.max(1, Number(flag('repeat') ?? '1'))
const outPath = flag('out') ?? '.agents/learnings/jev-validation.json'
/** Verify the harness without a TypeSafe key. Fakes a well-formed JEV reply. */
const stub = args.includes('--stub')

/**
 * JEV input cost, USD per million tokens. $0.42 at the $20 tier, $0.25 at the
 * $100 tier. Compare against lib/billing/costs.ts MODEL_RATES, which are the
 * numbers production actually pays.
 */
const JEV_INPUT_USD_PER_MTOK = 0.42

/**
 * JEV `score` answers are fractional indexes into the ordered criteria array
 * (0-based), NOT 0-100 values. The committed adapter treated them as 0-100,
 * which would turn a level-8 answer into 8/100 and grade every rubric F.
 */
function jevScoreToHundred(raw: number, levels: number): number {
  if (levels < 2) return 0
  const clamped = Math.max(0, Math.min(levels - 1, raw))
  return Math.round((clamped / (levels - 1)) * 100)
}

const SCORE_DIMENSIONS: Array<{ key: string; instructions: string; levels: string[] }> = [
  {
    key: 'messageScore',
    instructions:
      'Rate the MESSAGE dimension: does the page make the visitor feel understood and compelled to act? Consider hero clarity, audience specificity, outcome focus, CTA quality, social proof, and hierarchy of value.',
    levels: [
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
  {
    key: 'experienceScore',
    instructions:
      'Rate the EXPERIENCE dimension: does the page feel professional, trustworthy, and easy to use? Consider the 5-second glance test, mobile layout, visual hierarchy, perceived speed, alignment and spacing.',
    levels: [
      'Broken - unusable, major layout failures',
      'Very poor - looks unprofessional, confusing',
      'Poor - significant visual or UX issues',
      'Below average - noticeable friction, amateur feel',
      'Average - functional but not polished',
      'Above average - clean, mostly professional',
      'Good - solid visual hierarchy, trustworthy',
      'Very good - polished, smooth mobile experience',
      'Excellent - delightful, best-in-class UX',
      'Perfect - flawless experience',
    ],
  },
  {
    key: 'reachScore',
    instructions:
      'Rate the REACH dimension: can the right people find, share, and trust this page? Consider social preview, SEO fundamentals, page completeness, and trust signals.',
    levels: [
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
  {
    key: 'overallScore',
    instructions: 'Overall quality score combining message, experience, and reach.',
    levels: [
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
]

function buildQuestions(): Record<string, JevQuestion> {
  const questions: Record<string, JevQuestion> = {
    pageType: {
      type: 'choice',
      instructions: 'What type of page is this? Choose the single best match.',
      criteria: {
        homepage: 'Main entry point, broad overview',
        pricing: 'Pricing plans, tiers, feature comparison',
        landing: 'Campaign-specific conversion page',
        dashboard: 'Logged-in app dashboard',
        portfolio: 'Showcase of work or projects',
        article: 'Blog post, documentation, guide',
        other: 'None of the above',
      },
    },
  }
  for (const dimension of SCORE_DIMENSIONS) {
    questions[dimension.key] = {
      type: 'score',
      instructions: dimension.instructions,
      criteria: dimension.levels,
    }
  }
  return {
    ...questions,
    hasHttps: { type: 'noul', instructions: 'Does the page load over HTTPS with a valid certificate?' },
    hasSocialPreview: {
      type: 'noul',
      instructions: 'Does the page have valid Open Graph tags (og:title, og:description, og:image) that would render a proper social card?',
    },
    hasMobileCta: {
      type: 'noul',
      instructions: 'Is the primary CTA visible and tappable on a 375px mobile viewport without scrolling past the first screen?',
    },
    hasNoConsoleErrors: { type: 'noul', instructions: 'Are there zero JavaScript console errors on page load?' },
    hasPrivacyContact: {
      type: 'noul',
      instructions: 'Does the page have both a privacy policy link and contact information?',
    },
    launchReadiness: {
      type: 'choice',
      instructions: 'Based on all evidence, is this page safe to share publicly?',
      criteria: {
        safe: 'Ship it - no blockers',
        fix_first: 'Fix top issues first, then ship',
        not_ready: 'Do not post yet - major problems',
      },
    },
  }
}

const QUESTIONS = buildQuestions()
const LEVELS: Record<string, number> = Object.fromEntries(
  Object.entries(QUESTIONS).flatMap(([id, q]) => (q.type === 'score' ? [[id, q.criteria.length] as const] : []))
)

function requireAnswer<T extends JevAnswer['type']>(answers: Record<string, JevAnswer>, key: string, type: T) {
  const answer = answers[key]
  if (!answer || answer.type !== type) throw new Error(`JEV answer "${key}" missing or not ${type}`)
  return answer as Extract<JevAnswer, { type: T }>
}

function toTriage(answers: Record<string, JevAnswer>, purpose: string): TriageOutput {
  const score = jevScoreToHundred(
    requireAnswer(answers, 'overallScore', 'score').score,
    LEVELS.overallScore!
  )
  const dims = Object.fromEntries(
    (['messageScore', 'experienceScore', 'reachScore'] as const).map((key) => [
      key,
      jevScoreToHundred(requireAnswer(answers, key, 'score').score, LEVELS[key]!),
    ])
  ) as Record<'messageScore' | 'experienceScore' | 'reachScore', number>

  const statusFor = (s: number): TriageOutput['rubrics'][number]['status'] =>
    s >= GRADE_THRESHOLDS.A ? 'EXCELLENT'
    : s >= GRADE_THRESHOLDS.B ? 'GOOD'
    : s >= GRADE_THRESHOLDS.C ? 'NEEDS_WORK'
    : 'CRITICAL'

  const rubrics = RUBRIC_ORDER.map((name) => {
    const key = `${name.toLowerCase()}Score` as 'messageScore' | 'experienceScore' | 'reachScore'
    const s = dims[key]
    const conf = requireAnswer(answers, key, 'score').confidence
    return {
      name,
      score: s,
      grade: gradeFromScore(s),
      status: statusFor(s),
      assessmentState: 'ASSESSED' as const,
      confidence: conf,
      summary: `${name} ${s}/100 at confidence ${conf.toFixed(2)}.`,
      rubricPrompt: '',
      cursorPrompt: null,
      claudePrompt: null,
      windsurfPrompt: null,
      lovablePrompt: null,
      boltPrompt: null,
    }
  })

  const noul = (key: string) => requireAnswer(answers, key, 'noul').noul > 0.5
  const readiness = requireAnswer(answers, 'launchReadiness', 'choice').choice as TriageOutput['launchReadiness']

  return {
    pageJob: purpose === 'marketing' ? 'Convert visitors into customers' : 'Inform and engage visitors',
    pageType: requireAnswer(answers, 'pageType', 'choice').choice as TriageOutput['pageType'],
    verdict: `${score}/100. ${readiness === 'safe' ? 'Ready to ship.' : readiness === 'fix_first' ? 'Fix top issues first.' : 'Not ready.'}`,
    score,
    launchReadiness: readiness,
    launchChecklist: [
      { id: 'https', label: 'HTTPS', passed: noul('hasHttps') },
      { id: 'social-preview', label: 'Social Preview', passed: noul('hasSocialPreview') },
      { id: 'mobile-cta', label: 'Mobile CTA', passed: noul('hasMobileCta') },
      { id: 'console-errors', label: 'No Console Errors', passed: noul('hasNoConsoleErrors') },
      { id: 'privacy-contact', label: 'Privacy & Contact', passed: noul('hasPrivacyContact') },
    ],
    rubrics,
    newFlags: [],
  }
}

/** Baselines from lib/billing/costs.ts MODEL_RATES. */
const BASELINES = [
  { id: 'gpt-4o-mini (triage)', input: 0.15, output: 0.6 },
  { id: 'claude-haiku-4-5', input: 1.0, output: 5.0 },
  { id: 'claude-sonnet-5 (prescription)', input: 3.0, output: 15.0 },
] as const

/**
 * Does the JEV rubric score rescale to the grade the UI will actually render?
 * Catches a 0-9 level index leaking through as a 0-100 score.
 */
function gradeCoherence(run: JevRunRecord): string[] {
  const problems: string[] = []
  for (const [key, answer] of Object.entries(run.answers)) {
    if (!key.endsWith('Score') || key === 'overallScore') continue
    const raw = (answer as { score?: number }).score
    if (typeof raw !== 'number') continue
    const mapped = jevScoreToHundred(raw, LEVELS[key] ?? 10)
    const rubric = key.replace('Score', '').toUpperCase() as 'MESSAGE' | 'EXPERIENCE' | 'REACH'
    if (gradeFromScore(mapped) !== run.grades[rubric]) {
      problems.push(
        `${run.fixture}: ${rubric} raw=${raw.toFixed(2)} -> ${mapped}/100 -> ` +
          `grade ${gradeFromScore(mapped)} but reported ${run.grades[rubric]}`
      )
    }
  }
  return problems
}

interface JevRunRecord {
  fixture: string
  tier: AccuracyHtmlFixture['tier']
  url: string
  score: number
  launchReadiness: string
  pageType: string
  grades: { MESSAGE: string; EXPERIENCE: string; REACH: string }
  checklistPassed: number
  inputTokens: number
  costUsd: number
  durationMs: number
  answers: Record<string, unknown>
  error?: string
}

/**
 * A well-formed fake JEV reply. Used only to prove the harness, mapping and
 * reporting work end to end. Never a source of accuracy numbers.
 */
function stubJevReply(fixture: AccuracyHtmlFixture, inputTokens: number) {
  // Crude stand-in so the stub still varies by tier and exercises grade mapping.
  const base = fixture.tier === 'gold' ? 8.2 : fixture.tier === 'broken' ? 1.6 : 5.4
  const levels = Array.from({ length: 10 }, (_, i) => String(i))
  const dist = (peak: number) => {
    const raw = levels.map((_, i) => Math.exp(-((i - peak) ** 2) / 6))
    const sum = raw.reduce((a, b) => a + b, 0)
    const scaled = raw.map((v) => v / sum)
    scaled[peak] = Math.max(scaled[peak]!, 0.9)
    const total = scaled.reduce((a, b) => a + b, 0)
    return Object.fromEntries(levels.map((l, i) => [l, Number((scaled[i]! / total).toFixed(4))]))
  }
  const scoreDist = dist(Math.round(base))
  const score = Number(Object.entries(scoreDist).reduce((a, [l, p]) => (p > a[1] ? [l, p] as [string, number] : a), ['0', 0])[0])
  return {
    model: 'jev-1.13.0',
    answers: {
      pageType: { type: 'choice', choice: 'homepage', confidence: 0.8, probabilities: { homepage: 0.8, pricing: 0.05, landing: 0.05, dashboard: 0.03, portfolio: 0.03, article: 0.02, other: 0.02 } },
      messageScore: { type: 'score', score, confidence: 0.72, probabilities: scoreDist, legend: {} },
      experienceScore: { type: 'score', score, confidence: 0.7, probabilities: scoreDist, legend: {} },
      reachScore: { type: 'score', score, confidence: 0.74, probabilities: scoreDist, legend: {} },
      overallScore: { type: 'score', score, confidence: 0.75, probabilities: scoreDist, legend: {} },
      hasHttps: { type: 'noul', noul: 0.97 },
      hasSocialPreview: { type: 'noul', noul: fixture.tier === 'gold' ? 0.88 : 0.4 },
      hasMobileCta: { type: 'noul', noul: 0.7 },
      hasNoConsoleErrors: { type: 'noul', noul: fixture.tier === 'broken' ? 0.2 : 0.85 },
      hasPrivacyContact: { type: 'noul', noul: fixture.tier === 'gold' ? 0.9 : 0.45 },
      launchReadiness: { type: 'choice', choice: fixture.tier === 'broken' ? 'not_ready' : 'fix_first', confidence: 0.65, probabilities: { safe: 0.1, fix_first: 0.6, not_ready: fixture.tier === 'broken' ? 0.3 : 0.05 } },
    },
    usage: { input_tokens: inputTokens, cost_usd: (inputTokens / 1_000_000) * JEV_INPUT_USD_PER_MTOK, credits_remaining_usd: 0 },
  }
}

async function runFixture(fixture: AccuracyHtmlFixture): Promise<JevRunRecord> {
  const started = Date.now()
  const base = {
    fixture: fixture.file,
    tier: fixture.tier,
    url: fixture.url,
  }

  if (!existsSync(`${ACCURACY_FIXTURE_DIR}/${fixture.file}`)) {
    return { ...base, score: 0, launchReadiness: 'n/a', pageType: 'n/a', grades: { MESSAGE: 'F', EXPERIENCE: 'F', REACH: 'F' }, checklistPassed: 0, inputTokens: 0, costUsd: 0, durationMs: 0, answers: {}, error: 'missing fixture file' }
  }

  const html = readFileSync(`${ACCURACY_FIXTURE_DIR}/${fixture.file}`, 'utf-8')
  const meta = parseMetadataFromHtml(html, fixture.url)

  // Deterministic flags are part of the JEV state, so we need them real.
  const { flags } = await runAccuracyFixtureChecks(fixture)

  try {
    const purpose = detectPagePurpose(meta, fixture.url)
    const state = {
      url: fixture.url,
      pageText: meta.pageText.slice(0, 8000),
      metadata: {
        title: meta.title,
        description: meta.description,
        h1s: meta.h1s,
        ctaTexts: meta.ctaTexts,
        hasStructuredData: meta.hasStructuredData,
        hasPrivacyPolicy: meta.hasPrivacyPolicy,
        hasContactInfo: meta.hasContactInfo,
      },
      deterministicFlags: flags.map((f) => ({
        checkId: f.checkId,
        problem: f.problem,
        rubric: f.rubric,
        severity: f.severity,
      })),
      pagePurpose: purpose,
    }
    const result = stub
      ? (() => {
          const fake = stubJevReply(fixture, 3200)
          return {
            output: toTriage(fake.answers, purpose.purpose),
            usage: {
              inputTokens: 3200,
              outputTokens: 0,
              model: 'jev-1.13.0',
              costUsd: (3200 / 1_000_000) * JEV_INPUT_USD_PER_MTOK,
            },
            rawJevAnswers: fake.answers as Record<string, JevAnswer>,
          }
        })()
      : await (async () => {
          const response = await callJev({ state, questions: QUESTIONS })
          return {
            output: toTriage(response.answers, purpose.purpose),
            usage: {
              inputTokens: response.usage.input_tokens,
              outputTokens: 0,
              model: response.model,
              costUsd: response.usage.cost_usd,
            },
            rawJevAnswers: response.answers,
          }
        })()
    const grades = Object.fromEntries(
      result.output.rubrics.map((r) => [r.name, r.grade])
    ) as JevRunRecord['grades']

    return {
      ...base,
      score: result.output.score,
      launchReadiness: result.output.launchReadiness,
      pageType: result.output.pageType,
      grades,
      checklistPassed: result.output.launchChecklist.filter((c) => c.passed).length,
      inputTokens: result.usage.inputTokens,
      costUsd: result.usage.costUsd,
      durationMs: Date.now() - started,
      answers: result.rawJevAnswers as Record<string, unknown>,
    }
  } catch (err) {
    return {
      ...base,
      score: 0,
      launchReadiness: 'n/a',
      pageType: 'n/a',
      grades: { MESSAGE: 'F', EXPERIENCE: 'F', REACH: 'F' },
      checklistPassed: 0,
      inputTokens: 0,
      costUsd: 0,
      durationMs: Date.now() - started,
      answers: {},
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Corpus expectations that JEV output can actually be graded against. */
function gradeAgainstCorpus(fixture: AccuracyHtmlFixture, run: JevRunRecord): string[] {
  const problems: string[] = []
  if (run.error) return [`${fixture.file}: ${run.error}`]

  const gold = fixture.tier === 'gold'
  // A gold-standard site must not read as "do not post yet".
  if (gold && run.launchReadiness === 'not_ready') {
    problems.push(`${fixture.file}: gold fixture judged not_ready (launch gate too harsh)`)
  }
  if (fixture.tier === 'broken' && run.launchReadiness === 'safe') {
    problems.push(`${fixture.file}: broken fixture judged safe (launch gate too soft)`)
  }
  // Score must land in a plausible band for the tier.
  if (gold && run.score < 40) {
    problems.push(`${fixture.file}: gold fixture scored ${run.score} (<40) - likely under-calibrated`)
  }
  if (fixture.tier === 'broken' && run.score > 70) {
    problems.push(`${fixture.file}: broken fixture scored ${run.score} (>70) - over-calibrated`)
  }
  return problems
}

/** Repeat-run spread: does the same input yield the same score? */
function scoreSpread(scores: number[]): number | null {
  if (scores.length < 2) return null
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length
  return Math.sqrt(variance)
}

async function main() {
  if (!stub && !isJevConfigured()) {
    console.error('TYPESAFE_API_KEY is not set. Add it to .env.local, or re-run with --stub to verify the harness only.')
    process.exit(1)
  }
  if (stub) {
    console.log('STUB MODE: JEV replies are faked. Verifies wiring only, produces NO accuracy numbers.\n')
  }

  const fixtures = accuracyGateFixtures().filter((f) => !only || f.file === only)
  if (fixtures.length === 0) {
    console.error(`No fixture matched --fixture ${only}`)
    process.exit(1)
  }

  console.log(`JEV validation: ${fixtures.length} fixtures x ${repeat} run(s)\n`)

  const allProblems: string[] = []
  const runsPerFixture: JevRunRecord[][] = []
  let totalTokens = 0
  let totalCost = 0
  let totalMs = 0
  let errorCount = 0

  for (const fixture of fixtures) {
    const runs: JevRunRecord[] = []
    for (let i = 0; i < repeat; i += 1) {
      const run = await runFixture(fixture)
      runs.push(run)
      if (run.error) errorCount += 1
    }
    runsPerFixture.push(runs)
    const first = runs[0]!
    totalTokens += runs.reduce((s, r) => s + r.inputTokens, 0)
    totalCost += runs.reduce((s, r) => s + r.costUsd, 0)
    totalMs += runs.reduce((s, r) => s + r.durationMs, 0)
    allProblems.push(...gradeAgainstCorpus(fixture, first), ...gradeCoherence(first))

    const consistency = repeat > 1
      ? scoreSpread(runs.map((r) => r.score))
      : null
    const suffix = repeat > 1 && consistency != null ? `  score_sd=${consistency.toFixed(1)}` : ''
    console.log(
      `${first.error ? 'FAIL' : ' ok '}  ${fixture.file.padEnd(34)} ` +
        `tier=${fixture.tier.padEnd(10)} score=${String(first.score).padStart(3)} ` +
        `grades=${first.grades.MESSAGE}/${first.grades.EXPERIENCE}/${first.grades.REACH} ` +
        `ready=${first.launchReadiness.padEnd(10)} ` +
        `checklist=${first.checklistPassed}/5 ` +
        `${first.inputTokens}tok $${first.costUsd.toFixed(5)} ${first.durationMs}ms${suffix}`
    )
    if (first.error) console.log(`        error: ${first.error}`)
  }

  // ── Verdict ────────────────────────────────────────────────────────────────
  const n = runsPerFixture.length
  const avgTokens = n ? totalTokens / n : 0
  const avgCost = n ? totalCost / n : 0
  const avgMs = n ? totalMs / n : 0
  console.log('\n─── cost / latency ───')
  console.log(`avg input tokens   ${avgTokens.toFixed(0)} per call`)
  console.log(`avg JEV cost       $${avgCost.toFixed(6)} per call`)
  console.log(`avg latency        ${avgMs.toFixed(0)}ms per call`)
  console.log(`errors             ${errorCount}/${n * repeat}`)

  // Honest economics. JEV is paid on INPUT ONLY, so it does not automatically
  // beat a cheap model on input alone - gpt-4o-mini input is $0.15/M vs JEV
  // $0.42/M. The win comes from either (a) avoiding a costly model's output
  // tokens, or (b) one batched call replacing several LLM round trips.
  console.log('\n─── cost vs each baseline (per call, same input volume) ───')
  console.log('JEV output is free. LLM cost = input@rate + est_output@rate.\n')
  console.log('  baseline                      ~out tok    cost        vs JEV')
  const jevPerCall = avgCost
  for (const base of BASELINES) {
    for (const outTokens of [800, 3000]) {
      const cost = (avgTokens / 1_000_000) * base.input + (outTokens / 1_000_000) * base.output
      const delta = jevPerCall > 0 ? (cost / jevPerCall) : 0
      const verdict = delta >= 1 ? `${delta.toFixed(1)}x costlier` : `${(1 / delta).toFixed(1)}x cheaper`
      console.log(
        `  ${base.id.padEnd(28)} ${String(outTokens).padStart(6)}  $${cost.toFixed(6)}  ${verdict}`
      )
    }
  }

  // The crossover: how many output tokens make an LLM call cost more than JEV.
  console.log('\n─── break-even output tokens (JEV input == LLM total) ───')
  for (const base of BASELINES) {
    const jevCostAtVolume = (avgTokens / 1_000_000) * JEV_INPUT_USD_PER_MTOK
    const inputCost = (avgTokens / 1_000_000) * base.input
    const room = jevCostAtVolume - inputCost
    const breakEven = room > 0 ? (room / base.output) * 1_000_000 : 0
    console.log(
      `  ${base.id.padEnd(28)} ${breakEven <= 0 ? 'JEV always dearer on input alone' : `${Math.round(breakEven).toLocaleString()} output tokens`}`
    )
  }

  if (repeat > 1) {
    console.log('\n─── score stability (repeat runs) ───')
    for (let i = 0; i < runsPerFixture.length; i += 1) {
      const runs = runsPerFixture[i]!
      const sd = scoreSpread(runs.map((r) => r.score))
      if (sd != null) console.log(`  ${runs[0]!.fixture.padEnd(34)} sd=${sd.toFixed(1)}  [${runs.map((r) => r.score).join(', ')}]`)
    }
  }

  console.log('\n─── corpus grading ───')
  if (allProblems.length === 0) {
    console.log('All corpus expectations met.')
  } else {
    for (const p of allProblems) console.error(`- ${p}`)
  }

  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        model: 'jev-1.13.0',
        repeat,
        fixtures: runsPerFixture.map((runs) => runs[0]),
        summary: {
          avgTokens,
          avgCostUsd: avgCost,
          avgLatencyMs: avgMs,
          stub,
          errorCount,
          corpusProblems: allProblems,
        },
      },
      null,
      2
    )
  )
  console.log(`\nraw results -> ${outPath}`)

  if (allProblems.length > 0) process.exit(1)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
