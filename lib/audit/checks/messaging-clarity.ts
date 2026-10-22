import { renderedContentMetadata } from '../browser/rendered-copy'
import { PageMetadata } from '../metadata'
import { CHECK_TEXT_LIMIT } from '../page-text-limits'
import type { DeterministicFlag } from '../flag-types'
import { normalizeHeadingText } from './utils'
import { recordObservation, type CheckRecorder } from './assertion'
import { QUALITATIVE_GUIDANCE_COPY } from '@/lib/marketing/copy/qualitative-guidance'

const WEAK_VALUE_WORDS = /\b(solution|platform|tool|app|software|product|company|business)\b/i

// B2B-common vocabulary that is standard positioning language, not jargon.
// These words appear naturally in legitimate product marketing and should not
// trigger a jargon check unless they dominate the headings (3+ matches).
const B2B_COMMON_TERMS = /\b(seamless|robust|scalable|innovative|end-to-end|ecosystem)\b/i

const JARGON_PATTERNS = [
  /\b(leverage|utilize|synerg(y|ize)|paradigm|disrupt|empower|enterprise-grade|best-in-class|cutting-edge|next-gen|holistic)\b/i,
]

const AUDIENCE_REGEX = /\b(for\s+(?:[\w-]+\s+){0,3}(teams?|developers?|designers?|founders?|startups?|companies?|enterprises?|creators?|marketers?|operators?|agencies?)|built\s+for|designed\s+for|made\s+for)\b/i
// Audience nouns in the headline or its introduction are also explicit context.
const AUDIENCE_NOUN = /\b(teams?|developers?|designers?|founders?|startups?|companies|enterprises?|creators?|marketers?|operators?|agencies|students?|teachers?|patients?|clinicians?|researchers?)\b/i
const OUTCOME_REGEX = /\b(build|builder|ship|launch|convert|grow|save|reduce|increase|automate|manage|track|measure|find|fix|audit|test|improve|create|book|sell|close|support|schedule|plan|organi[sz]e|collaborate|deploy|monitor|analy[sz]e|design|write|send|email|pay|scale|streamline|simplify|accelerate|generate|discover|learn|hire|invoice|onboard|search|browse|explore|read|watch|listen|download|install|run|use|access|open|store|share|connect|communicate|message|chat|call|meet|present|report|visualize|process|handle|deliver|publish|post|upload|import|export|sync|backup|secure|protect|filter|sort|list|view|show|display|compose|draft|edit|review|approve|submit|transfer|migrate)\b|\b\d+(?:x|%)\b/i

export function runMessagingClarityChecks(meta: PageMetadata, record?: CheckRecorder): DeterministicFlag[] {
  meta = renderedContentMetadata(meta)
  const findings: DeterministicFlag[] = []
  const bodyText = (meta.pageText ?? '').slice(0, CHECK_TEXT_LIMIT)
  const h1s = meta.h1s ?? []
  const h1 = normalizeHeadingText(h1s[0] ?? '')
  const h2s = meta.h2s ?? []

  const combinedTopText = [h1, meta.headlineSupport, ...h2s.slice(0, 3)].filter(Boolean).join(' ')

  const hasAudience = AUDIENCE_REGEX.test(combinedTopText) || AUDIENCE_NOUN.test([h1, meta.headlineSupport].filter(Boolean).join(' '))
  const hasOutcome = OUTCOME_REGEX.test(combinedTopText)
  recordObservation(record, 'headline-outcome', 'Headline positioning signals', 'Captured headline avoids the generic-category-only pattern',
    `Headline: ${h1}. Supporting introduction: ${meta.headlineSupport ?? 'not recorded'}. Audience pattern ${hasAudience}, outcome pattern ${hasOutcome}.`,
    h1 ? !WEAK_VALUE_WORDS.test(h1) || hasAudience || hasOutcome : undefined, true)

  if (h1 && WEAK_VALUE_WORDS.test(h1) && !hasAudience && !hasOutcome) {
    findings.push({
      checkId: 'messaging-weak-value-prop',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Headline uses vague product-category words instead of naming the specific outcome',
      evidence: `H1: "${h1}" uses generic category words like "platform" or "solution" without clearly naming both the customer and the outcome.`,
      fix: '1. Replace the generic category word with the specific outcome: "Plan releases for engineering teams" instead of "The platform for building"\n2. Name the audience in the headline: "for developers", "for product teams"\n3. Lead with the result the customer gets, not what the product is',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  // Collect jargon matches from pure-jargon patterns AND B2B-common terms.
  // B2B-common terms (seamless, robust, scalable, etc.) are standard
  // positioning language - require a higher threshold to avoid false positives
  // on legitimate product pages like Stripe or Vercel.
  const jargonMatches: string[] = []
  for (const { source } of JARGON_PATTERNS.map((p) => ({ source: p }))) {
    const match = combinedTopText.match(source)
    if (match) jargonMatches.push(match[0])
  }
  const b2bMatches: string[] = []
  const b2bMatch = combinedTopText.match(B2B_COMMON_TERMS)
  if (b2bMatch) b2bMatches.push(b2bMatch[0])

  const totalJargon = jargonMatches.length + b2bMatches.length
  recordObservation(record, 'heading-jargon', 'Heading wording patterns', 'Captured headings do not trigger the jargon rule',
    `${totalJargon} wording patterns matched in sampled headings. Audience and outcome patterns ${hasAudience && hasOutcome ? 'both present' : 'not both present'}.`,
    combinedTopText ? totalJargon === 0 || hasAudience && hasOutcome : undefined, true)

  // Skip jargon check entirely when the headline clearly names both audience
  // and outcome - such headlines are well-written even if they include a B2B
  // term like "robust" or "scalable".
  if (totalJargon > 0 && !(hasAudience && hasOutcome)) {
    // Pure jargon (leverage, synergy, etc.) is always flagged.
    // B2B-common terms only escalate when total jargon is 3+.
    const allMatches = [...jargonMatches, ...b2bMatches]
    const isHighDensity = totalJargon >= 3
    findings.push({
      checkId: 'messaging-jargon-overload',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: isHighDensity ? 'IMPORTANT' : 'POLISH',
      problem: `Headings contain wording to review`,
      evidence: `Found in visible headings: ${allMatches.slice(0, 3).join(', ')}. These phrase matches are suggestions for a wording review.`,
      fix: '1. Replace each jargon word with specific, concrete language\n2. Use "build apps" instead of "empower innovation"\n3. Use "works at any size" instead of "scalable enterprise-grade"\n4. Read each heading aloud - if it would sound natural in a conversation, keep it',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  // Only flag when the headline names neither who it is for nor what outcome the
  // visitor gets. A strong outcome-driven headline ("grow your revenue") does not
  // also need to name an audience, so requiring both signals to be absent stops
  // this from firing on the majority of well-written headlines.
  // Also skip when the headline is a clear product category statement (e.g.
  // "The React Framework for the Web", "AI App Builder"), these communicate
  // what the product IS, which is sufficient even without an explicit audience.
  const PRODUCT_CATEGORY_PATTERN = /^the\s+\w[\w\s]*\s+for\s+/i
  const isProductCategory = PRODUCT_CATEGORY_PATTERN.test(h1)
  recordObservation(record, 'audience-or-outcome', 'Headline audience or outcome signals',
    'Captured headline names a recognized audience, outcome, or product-category pattern',
    `Audience pattern ${hasAudience}, outcome pattern ${hasOutcome}, category pattern ${isProductCategory}.`,
    h1 ? hasAudience || hasOutcome || isProductCategory : undefined, true)
  if (h1 && !hasAudience && !hasOutcome && !isProductCategory) {
    findings.push({
      checkId: 'messaging-no-audience',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: 'Headline does not specify who this is for',
      evidence: `Headline: "${h1}". Supporting introduction: "${meta.headlineSupport ?? 'not recorded'}". No recognized audience, outcome, or product-category pattern matched this sample. Audience understanding was not measured.`,
      fix: '1. Add the target audience to the headline or subhead: "The analytics platform for product teams"\n2. Use the subheadline to clarify who should care\n3. If the audience is broad, frame it by their goal: "for teams that need to..."',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  const sentLengthThreshold = 30
  // Only analyze prose. Page-text extraction mashes adjacent UI elements (nav
  // labels, pricing cells, buttons) into one punctuation-free run, which looks
  // like a giant run-on "sentence" (e.g. "unitsUsage meterTokens used..."). Those
  // fragments show camelCase joins and low alphabetic-word ratios that never
  // occur in real sentences, so drop them before measuring sentence length.
  const isProse = (s: string): boolean => {
    const words = s.trim().split(/\s+/).filter(Boolean)
    if (words.length < 5) return false
    if ((s.match(/[a-z][A-Z]/g) || []).length >= 2) return false
    const alphaWords = words.filter((w) => /^[A-Za-z][A-Za-z'’-]*$/.test(w)).length
    return alphaWords / words.length >= 0.6
  }
  const proseBlocks = meta.renderedCopy?.proseBlocks
  const sentences = (proseBlocks ?? [bodyText]).flatMap(block => block.split(/[.!?]+/)).filter(isProse)
  const longSentences = sentences.filter((s) => s.trim().split(/\s+/).filter(Boolean).length > sentLengthThreshold)

  const hasRepeatedLongSentences = longSentences.length >= 3
  const hasRunOnPattern = longSentences.length >= 2 && longSentences.some((s) => s.trim().split(/\s+/).filter(Boolean).length >= 45)
  recordObservation(record, 'prose-sentence-length', 'Sampled prose length', 'Sampled prose does not trigger repeated long sentences or the run-on pattern',
    `${sentences.length} prose sentences sampled; ${longSentences.length} exceed ${sentLengthThreshold} words.`,
    sentences.length ? !hasRepeatedLongSentences && !hasRunOnPattern : undefined, true)

  if (hasRepeatedLongSentences || hasRunOnPattern) {
    findings.push({
      checkId: 'messaging-long-sentences',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: `${longSentences.length} body sentences exceed ${sentLengthThreshold} words, in the sampled prose`,
      evidence: `Sample: "${longSentences[0].trim().slice(0, 120)}..." (${longSentences[0].trim().split(/\s+/).filter(Boolean).length} words)`,
      fix: '1. Break long sentences into 2-3 shorter ones (aim for under 20 words)\n2. Use bullet points for complex lists instead of paragraph form\n3. Read copy aloud - if you run out of breath, split the sentence',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  const h1WordCount = h1.trim().split(/\s+/).filter(Boolean).length
  recordObservation(record, 'headline-length', 'Headline length', 'Captured headline has at least three words or a recognized outcome signal',
    `${h1WordCount} headline words; outcome pattern ${hasOutcome}.`, h1 ? h1WordCount >= 3 || hasOutcome : undefined, true)

  if (h1 && h1WordCount < 3 && !hasOutcome) {
    findings.push({
      checkId: 'messaging-headline-too-short',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: `Review context for the ${h1WordCount}-word headline`,
      evidence: `Headline: "${h1}" (${h1WordCount} words). Supporting introduction: "${meta.headlineSupport ?? 'not recorded'}". Visitor understanding was not measured.`,
      fix: QUALITATIVE_GUIDANCE_COPY.headline,
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
