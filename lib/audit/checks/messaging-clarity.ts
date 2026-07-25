import { PageMetadata } from '../metadata'
import { CHECK_TEXT_LIMIT } from '../page-text-limits'
import type { DeterministicFlag } from '../flag-types'
import { normalizeHeadingText } from './utils'

const WEAK_VALUE_WORDS = /\b(solution|platform|tool|app|software|product|company|business)\b/i

const JARGON_PATTERNS = [
  /\b(leverage|utilize|synerg(y|ize)|paradigm|disrupt|empower|innovative|robust|scalable|enterprise-grade|best-in-class|cutting-edge|next-gen|holistic|end-to-end|seamless|ecosystem)\b/i,
]

const AUDIENCE_REGEX = /\b(for\s+(?:[\w-]+\s+){0,3}(teams?|developers?|designers?|founders?|startups?|companies?|enterprises?|creators?|marketers?|operators?|agencies?)|built\s+for|designed\s+for|made\s+for)\b/i
const OUTCOME_REGEX = /\b(build|builder|ship|launch|convert|grow|save|reduce|increase|automate|manage|track|measure|find|fix|audit|test|improve|create|book|sell|close|support|schedule|plan|organi[sz]e|collaborate|deploy|monitor|analy[sz]e|design|write|send|email|pay|scale|streamline|simplify|accelerate|generate|discover|learn|hire|invoice|onboard|search|browse|explore|read|watch|listen|download|install|run|use|access|open|store|share|connect|communicate|message|chat|call|meet|present|report|visualize|process|handle|deliver|publish|post|upload|import|export|sync|backup|secure|protect|filter|sort|list|view|show|display|compose|draft|edit|review|approve|submit|transfer|migrate)\b|\b\d+(?:x|%)\b/i

export function runMessagingClarityChecks(meta: PageMetadata): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const bodyText = (meta.pageText ?? '').slice(0, CHECK_TEXT_LIMIT)
  const h1s = meta.h1s ?? []
  const h1 = normalizeHeadingText(h1s[0] ?? '')
  const h2s = meta.h2s ?? []

  const combinedTopText = [h1, ...h2s.slice(0, 3)].filter(Boolean).join(' ')

  const hasAudience = AUDIENCE_REGEX.test(combinedTopText)
  const hasOutcome = OUTCOME_REGEX.test(combinedTopText)

  if (h1 && WEAK_VALUE_WORDS.test(h1) && !hasAudience && !hasOutcome) {
    findings.push({
      checkId: 'messaging-weak-value-prop',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Headline uses vague product-category words instead of naming the specific outcome',
      evidence: `H1: "${h1}" uses generic category words like "platform" or "solution" without clearly naming both the customer and the outcome.`,
      fix: '1. Replace the generic category word with the specific outcome: "Build internal tools 10x faster" instead of "The platform for building"\n2. Name the audience in the headline: "for developers", "for product teams"\n3. Lead with the result the customer gets, not what the product is',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  const jargonMatches: string[] = []
  for (const { source } of JARGON_PATTERNS.map((p) => ({ source: p }))) {
    const match = combinedTopText.match(source)
    if (match) jargonMatches.push(match[0])
  }

  if (jargonMatches.length > 0) {
    findings.push({
      checkId: 'messaging-jargon-overload',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: jargonMatches.length >= 2 ? 'IMPORTANT' : 'POLISH',
      problem: `Headings contain marketing jargon that reduces clarity`,
      evidence: `Found in visible headings: ${jargonMatches.slice(0, 3).join(', ')}. These words sound impressive but don't tell the user what the product does.`,
      fix: '1. Replace each jargon word with specific, concrete language\n2. Use "build apps" instead of "empower innovation"\n3. Use "works at any size" instead of "scalable enterprise-grade"\n4. Read each heading aloud - if it would sound natural in a conversation, keep it',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  // Only flag when the headline names neither who it is for nor what outcome the
  // visitor gets. A strong outcome-driven headline ("grow your revenue") does not
  // also need to name an audience, so requiring both signals to be absent stops
  // this from firing on the majority of well-written headlines.
  if (h1 && !hasAudience && !hasOutcome) {
    findings.push({
      checkId: 'messaging-no-audience',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: 'Headline does not specify who this is for',
      evidence: `H1: "${h1}" - no audience signal found (e.g. "for teams", "for developers"). Without an audience, visitors may not self-identify.`,
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
  const sentences = bodyText.split(/[.!?]+/).filter(isProse)
  const longSentences = sentences.filter((s) => s.trim().split(/\s+/).filter(Boolean).length > sentLengthThreshold)

  const hasRepeatedLongSentences = longSentences.length >= 3
  const hasRunOnPattern = longSentences.length >= 2 && longSentences.some((s) => s.trim().split(/\s+/).filter(Boolean).length >= 45)

  if (hasRepeatedLongSentences || hasRunOnPattern) {
    findings.push({
      checkId: 'messaging-long-sentences',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: `${longSentences.length} body sentences exceed ${sentLengthThreshold} words, hurting scannability`,
      evidence: `Sample: "${longSentences[0].trim().slice(0, 120)}..." (${longSentences[0].trim().split(/\s+/).filter(Boolean).length} words)`,
      fix: '1. Break long sentences into 2-3 shorter ones (aim for under 20 words)\n2. Use bullet points for complex lists instead of paragraph form\n3. Read copy aloud - if you run out of breath, split the sentence',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  const h1WordCount = h1.trim().split(/\s+/).filter(Boolean).length

  if (h1 && h1WordCount < 3 && !hasOutcome) {
    findings.push({
      checkId: 'messaging-headline-too-short',
      rubric: 'MESSAGE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: `Headline is too short (${h1WordCount} words) to communicate value`,
      evidence: `H1: "${h1}" - at ${h1WordCount} words, it does not give the visitor enough context to understand the product.`,
      fix: '1. Expand the headline to 5-10 words that name the product, audience, and outcome\n2. Example: "Build internal tools 10x faster - for engineering teams"\n3. Use the subhead to add the "how" if the headline covers the "what"',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
