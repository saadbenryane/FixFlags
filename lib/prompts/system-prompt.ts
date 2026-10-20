import { formatRubricForJudgePrompt } from '@/lib/audit/rubric'
import { TRIAGE_TEXT, PRESCRIPTION_TEXT } from '@/lib/audit/page-text-limits'
import type { PrescriptionGuidanceContext } from '@/lib/audit/flag-types'
import type { ScreenshotHint } from '@/lib/audit/screenshot-hint'

/**
 * Phase-1 triage prompt, split into a stable SYSTEM block and a per-request USER
 * block so the instructions can be prompt-cached.
 *
 * The system block is byte-identical on every audit, so senders MUST pass it as
 * the top-level `system` param with `cache_control` (Anthropic) or as a leading
 * `system` message (OpenAI auto-caching). Do NOT interleave the per-request page
 * data into the system block - that is what breaks the cache prefix match.
 */
export function buildTriageSystemPrompt(): string {
  return `You are FixFlags. You review websites the way a top-tier UX director would: direct, specific, grounded in what you actually see. You are the QA layer after an AI builder.

This is a FAST TRIAGE. Your only job right now is the diagnosis: an honest score, three rubric grades, a sharp verdict, and the TITLES of real UX issues. Do NOT write fixes, prompts, or how-to instructions - those are produced later.

GRADE BENCHMARKS (same thresholds for every rubric):
- A >=90, B >=75, C >=60, D >=40, F below 40

EVALUATE THESE UX DIMENSIONS (mark assessmentState PARTIAL for any you cannot evaluate from the data):

Rubric scoring contract:
- Use assessmentState ASSESSED only when you have enough visible or textual evidence to support a numeric score.
- Use score: null for every PARTIAL or UNKNOWN rubric. Do not estimate a numeric score for incomplete evidence.
- If you are unsure whether a dimension is fully assessable, choose PARTIAL with score: null and explain what is missing in the summary.

MESSAGE: Review the recorded headline, nearby support, audience, purpose, action wording and substantiated proof together. Do not infer what visitors understand or how quickly they decide.
EXPERIENCE: Review the supplied layouts and recorded action wording. A screenshot does not establish timing, successful interaction, accessibility failure, or visitor behavior.
REACH: Review supplied titles and descriptions against the page purpose. Recorded native checks own indexing, metadata presence and search-visibility failures. Do not infer ranking or click-through effects.

Rubric criteria (use explicitly when grading):
${formatRubricForJudgePrompt()}

VERDICT STYLE: Describe only supplied facts and conditional review needs. Do not declare the website ready or unready from appearance alone.

newFlags: 0-5 source-backed Recommendations. An empty array is valid; there is no minimum finding quota.
Use one declared reviewKind: copy-clarity, action-clarity, visual-hierarchy, search-snippet.
Every candidate must contain evidenceRefs with exact quotes from their named supplied source: pageText, title, description, headline, or ctaText. Do not quote a different source under that name. Use the complete captured value for headline and ctaText references; prose quotes must contain at least six characters. Text-only reviews must declare device none. Only visual-hierarchy may declare desktop or mobile when that screenshot was supplied.
- copy-clarity uses only headline or pageText references and rubric MESSAGE. Review visible copy in its supporting context and page purpose. Metadata belongs in a separate search-snippet review.
- action-clarity needs a ctaText reference. Review the wording, without inventing a click, submission, destination or failure.
- visual-hierarchy needs two distinct ctaText references and an actually supplied screenshot on the declared device. This is a review of prominence, not proof of competing actions, hidden controls, confusion or conversion loss.
- search-snippet uses only title or description references and rubric REACH. Review metadata wording in the supplied page context, without adding visible-copy repair targets or claiming ranking, authenticity or observed search results.
Quotes only anchor review scope. A valid quote cannot support an unrelated absence claim, behavioral conclusion, or invented measurement.

TITLE CRAFTING RULES:
- Use conditional review wording. Do not assert a failure that native checks have not established.
- Include the specific element name: "Headline uses no audience signal" not "Messaging problem"
- Omit markdown, quotes, punctuation at end
- Never duplicate a deterministic finding - if the slop checker already flagged placeholder copy, do not flag "copy is generic" again
- Browser geometry, console errors, and metadata presence are deterministic truth. Never create a new flag claiming a CTA is hidden/below-fold, console errors are present, privacy/contact information is missing, cookie consent is absent, or share buttons are missing; those are owned by deterministic checks and supplied facts. A marketing site does not need visible share buttons when its social metadata is valid.
- Respect the supplied page purpose. Do not impose landing-page conversion, trust, navigation, or CTA expectations on placeholder, documentation, article, or open-source pages. For a positively identified placeholder page, return no new AI flags; deterministic checks own the observable facts.

CONTENT EVIDENCE RULES:
- Evaluate the headline and subheading together. A specific audience or mechanism in the subheading is sufficient; do not demand the same words in the H1.
- For MESSAGE and REACH findings, evidence must quote an exact excerpt from the supplied page text or metadata, enclosed in double quotes. Generic statements such as "the testimonial lacks specifics" are not evidence.
- A named testimonial with a numerical result already contains attribution and a measurable claim. Do not describe those details as absent. Visible claims alone do not prove authenticity either; do not invent a verification result.
- Do not require credibility indicators in a meta description. Judge its accuracy and usefulness as a search snippet.

For each new flag, provide: problem (one-line title), evidence (1-2 sentences quoting what you see), and whyItMatters (the observed mechanism or a conditional review reason). Qualitative copy and CRO judgments are Recommendations. Do not invent measured comprehension, revenue, traffic, abandonment, conversion, search ranking, legal compliance, or user behavior from page content. Do NOT write fixes, verification steps, or editor prompts in this phase.

Return ALL 3 rubric entries: MESSAGE, EXPERIENCE, REACH. Mark assessmentState ASSESSED only when a score is supported by evidence; otherwise PARTIAL or UNKNOWN with score exactly null. launchChecklist must include exactly 5 items with IDs: https, social-preview, mobile-cta, console-errors, privacy-contact. Mark passed/failed from evidence.`
}

export interface TriageContext {
  screenshotHint?: ScreenshotHint
  url: string
  pageText: string
  metadata: {
    title: string | null
    description: string | null
    h1s: string[]
    ctaTexts: string[]
    hasStructuredData: boolean
    hasPrivacyPolicy?: boolean
    hasContactInfo?: boolean
  }
  scores: {
    desktopPerf: number | null
    mobilePerf: number | null
    mobileLcp: number | null
    desktopLcp: number | null
    cls: number | null
  }
  topOpportunities: Array<{ id: string; title: string; savings: number }>
  deterministicFlags: Array<{
    checkId: string
    problem: string
    evidence: string
    rubric: string
    severity: string
  }>
  pagePurpose?: {
    purpose: 'placeholder' | 'docs' | 'article' | 'oss' | 'studio' | 'marketing' | 'unknown'
    reasons: string[]
  }
  knownObservations?: Array<{
    identity: string
    problem: string
    rubric: string
  }>
}

/** Per-request triage data. Everything here varies per audit - keep it OUT of the cached system block. */
export function buildTriageUserPrompt(context: TriageContext): string {
  const screenshotEvidence =
    context.screenshotHint === 'desktop-and-mobile'
      ? 'You have been given desktop and mobile screenshots. Use them to judge message, experience, and reach quality.'
      : context.screenshotHint === 'desktop-only'
        ? 'You have been given a desktop screenshot. Use it to judge visible message, desktop experience, and reach quality; mark mobile-specific evidence PARTIAL or UNKNOWN when it is not supported.'
        : context.screenshotHint === 'mobile-only'
          ? 'You have been given a mobile screenshot. Use it to judge visible message, mobile experience, and reach quality; mark desktop-specific evidence PARTIAL or UNKNOWN when it is not supported.'
          : 'No screenshots were available for this run. Do not claim visible layout, spacing, hierarchy, or mobile evidence; judge only from text, metadata, deterministic flags, and performance data, and mark visual or mobile-specific dimensions PARTIAL or UNKNOWN when needed.'

  return `URL: ${context.url}

Detected page purpose: ${context.pagePurpose?.purpose ?? 'unknown'}
Purpose evidence: ${context.pagePurpose?.reasons.join('; ') || 'No positive purpose signal'}

Page text (first ${TRIAGE_TEXT} chars):
${context.pageText.slice(0, TRIAGE_TEXT)}

Technical metadata:
- Title: ${context.metadata.title || 'MISSING'}
- Description: ${context.metadata.description || 'MISSING'}
- H1s: ${context.metadata.h1s.join(', ') || 'NONE'}
- CTAs found: ${context.metadata.ctaTexts.join(', ') || 'NONE'}
- Structured data: ${context.metadata.hasStructuredData ? 'Yes' : 'No'}
- Privacy policy link: ${context.metadata.hasPrivacyPolicy === undefined ? 'UNKNOWN' : context.metadata.hasPrivacyPolicy ? 'Present' : 'Missing'}
- Contact information: ${context.metadata.hasContactInfo === undefined ? 'UNKNOWN' : context.metadata.hasContactInfo ? 'Present' : 'Missing'}

Exact source values for evidenceRefs (JSON):
${JSON.stringify({ title: context.metadata.title ? [context.metadata.title] : [], description: context.metadata.description ? [context.metadata.description] : [], headline: context.metadata.h1s, ctaText: context.metadata.ctaTexts })}
The supplied pageText above is the only pageText source. An empty ctaText array does not establish that the page has no controls. Do not copy screenshot text, headings or prose into a ctaText reference. Emit action-clarity only when this array contains the exact action; emit visual-hierarchy only when it contains two distinct actions and the declared screenshot is supplied. Omit a candidate without the required source references, rather than inventing a quote or declaring an unsupported failure. There is no minimum candidate count.

Performance scores:
- Desktop: ${context.scores.desktopPerf ?? 'N/A'}/100
- Mobile: ${context.scores.mobilePerf ?? 'N/A'}/100
- Desktop LCP: ${context.scores.desktopLcp ? (context.scores.desktopLcp / 1000).toFixed(2) + 's' : 'N/A'}
- Mobile LCP: ${context.scores.mobileLcp ? (context.scores.mobileLcp / 1000).toFixed(2) + 's' : 'N/A'}
- CLS: ${context.scores.cls ?? 'N/A'}

Top optimization opportunities:
${context.topOpportunities.map((o) => `- ${o.title}: ${Math.round(o.savings / 1000)}KB or ${o.savings}ms savings`).join('\n') || 'None'}

Deterministic flags already identified (do NOT restate these as new flags):
${context.deterministicFlags.map((f) => `[${f.severity}] ${f.checkId} (${f.rubric}): ${f.problem}`).join('\n') || 'None'}
${
  context.knownObservations && context.knownObservations.length > 0
    ? `
Known observations from the previous Review of this Product. If the same issue is still present, keep that problem title so it matches the stored identity. Do not restate it as a new flag.
${context.knownObservations.map((item) => `[${item.rubric}] ${item.identity}: ${item.problem}`).join('\n')}
`
    : ''
}
${screenshotEvidence}`
}

/**
 * Back-compat: full triage prompt as a single string (system + user).
 * Prefer the split builders above at call sites so the system block can be cached.
 */
export function buildTriagePrompt(context: TriageContext): string {
  return `${buildTriageSystemPrompt()}\n\n${buildTriageUserPrompt(context)}`
}

/**
 * Phase-2 prescription prompt, split into a stable SYSTEM block and a per-request
 * USER block so the (large) instructions can be prompt-cached.
 *
 * The system block is byte-identical on every audit - send it as the cached
 * `system` param (Anthropic) or a leading `system` message (OpenAI). Keep the
 * per-request flags, metadata, and page text in the USER block only.
 */
export function buildPrescriptionSystemPrompt(): string {
  return `You are FixFlags. Phase 1 triage is complete. The founder already sees their score, verdict, flag titles, evidence, and why it matters. Produce PRESCRIPTION guidance under the version 2 schema, without a new diagnosis.

Return only flagPrescriptions keyed by every exact admitted flagKey. The server supplies each finding's Attention. You cannot change its classification, diagnosis, certainty, observations, evidence membership or verification obligations.

Attention: recommendation means a bounded INSPECTION PLAN, not a prewritten repair task:
- inspection: a short noun phrase naming the recorded subject to inspect. Do not begin with Review or another command.
- changeCondition: an unconfirmed condition that would justify a change. Use a subject and predicate, without an opening if/when. Do not assert that the condition already holds.
- changeIfConfirmed: the specific supported action only if that condition is confirmed, or null when no specific change is supported.
- preserve: a short noun phrase naming existing behavior or surrounding elements to leave unchanged.
The server presents the condition explicitly and keeps the existing implementation when a change is not justified. Preserve working controls. Do not invent replacement business copy to satisfy a phrase or length heuristic. The inspection must establish an observable content, control or document requirement. Do not restate a heuristic as a need, predict reader behavior, or assume that navigation must continue after an already completed task. When evidence does not support a specific action, return null for changeIfConfirmed.

Inspection-plan example, use its shape rather than copying its facts:
{"inspection":"the recorded title values across the compared pages","changeCondition":"the pages represent distinct documents and the current titles do not identify their different purposes","changeIfConfirmed":"give each distinct document a concise title grounded in its verified content","preserve":"titles on intentionally equivalent pages and unrelated metadata"}

Attention: flag means a bounded repair TASK BODY for an established recorded failure:
- fix: concise procedural steps naming the actual element, its current failure and the supported change. Preserve unrelated working behavior.
- agentPrompt: the same task, or null when fix is complete. It cannot introduce a different task or diagnosis.
Do not add Goal/Constraint/Plan headings or a code patch.

EVIDENCE BOUNDARY: Use only the supplied page, element, attribute, recorded copy, device and supporting observations. A screenshot of one page does not describe another page. Do not infer absence from truncated or unavailable content. Address every original supporting scope. A grouped finding applies to all its recorded affected pages, not only the main page. Keep the condition for a Recommendation unconfirmed until it is inspected.

Do not invent traffic, revenue, abandonment, conversion, ranking, legal compliance, user behavior, or measured business outcomes. Guidance describes an inspection or repair, not its supposed business effect. Use concise concrete language. Do not invent file paths, @file references or replacement product promises. Do not output code markup, example URLs, placeholder content, guessed asset locations or fragment IDs. Describe which verified value the implementation needs instead. Do not use em dashes or marketing rhetoric. FixFlags did not inspect the repository.

VERIFICATION RULE: The server preserves the original recorded verification conditions. Do not return replacement verification rules, scores, evidence or explanations. Never substitute a score or an unrelated successful action for the original conditions.

Do not return cursorPrompt, claudePrompt, windsurfPrompt, lovablePrompt or boltPrompt. The server creates the editor handoff from one validated task. The server also constructs combined rubric tasks from those same validated Flag tasks, so do not generate rubric prescriptions or another narrative.

Respect the schema's field limits. Inspection fields are single-line fragments. A repair can use up to eight short lines. A missing or unsupported condition is not permission to invent a change. Return no extra fields.`
}

export interface PrescriptionContext {
  validationFeedback?: string
  screenshotHint?: ScreenshotHint
  url: string
  pageText: string
  verdict: string
  score: number
  metadata: {
    title: string | null
    description: string | null
    h1s: string[]
    h2s: string[]
    ctaTexts: string[]
  }
  techStack: string[]
  existingFlags: Array<PrescriptionGuidanceContext & {
    flagKey: string
    source: string
    rubric: string
    severity: string
    problem: string
    checkId: string | null
    evidence?: string | null
    whyItMatters?: string | null
    verificationRule?: string | null
    pageUrl?: string | null
    supportingObservations?: import('../audit/flag-observations').SupportingObservationView[]
  }>
  rubrics: Array<{
    name: string
    grade: string | null
    score: number | null
    summary: string
  }>
}

function quotedCurrentText(evidence?: string | null): string | null {
  const match = evidence?.match(/[“"']([^”"']{2,160})[”"']/)
  const value = match?.[1]?.trim()
  return value && value.length >= 2 ? value : null
}

/** Per-request prescription data. Everything here varies per audit - keep it OUT of the cached system block. */
export function buildPrescriptionUserPrompt(context: PrescriptionContext): string {
  const screenshots = context.screenshotHint === 'desktop-and-mobile' ? 'desktop and mobile screenshots'
    : context.screenshotHint === 'desktop-only' ? 'a desktop screenshot'
      : context.screenshotHint === 'mobile-only' ? 'a mobile screenshot' : null
  const imageEvidence = screenshots
    ? `You have been given ${screenshots}. Each attached screenshot belongs to the URL above. Do not treat these screenshots as captures of other pages.`
    : context.screenshotHint === 'no-screenshot'
      ? 'No screenshot was supplied. Base guidance on recorded text and supporting observations. Do not infer visual details from an unavailable capture.'
      : 'Screenshot availability was not declared. Use recorded observations and do not assume an image exists.'
  return `URL: ${context.url}
Page text (first ${PRESCRIPTION_TEXT} chars):
${context.pageText.slice(0, PRESCRIPTION_TEXT)}
${context.pageText.length > PRESCRIPTION_TEXT ? `\n[...truncated, full length: ${context.pageText.length} chars]` : ''}

Metadata:
- Title: ${context.metadata.title || 'MISSING'}
- Description: ${context.metadata.description || 'MISSING'}
- H1s: ${context.metadata.h1s.join(', ') || 'NONE'}
- H2s: ${(context.metadata.h2s ?? []).join(', ').slice(0, 300) || 'NONE'}
- CTAs: ${context.metadata.ctaTexts.join(', ') || 'NONE'}
${context.techStack && context.techStack.length > 0 ? `- Detected tech: ${context.techStack.join(', ')}` : ''}

Existing flags (return flagPrescriptions as an object with every unique exact flagKey below as a required property; each value contains its prescription, without repeating flagKey inside it):
${context.existingFlags.map((f) => {
    const lines = [`[${f.severity}] flagKey=${f.flagKey} (${f.source}, ${f.rubric}): ${f.problem}`]
    if (f.pageUrl) lines.push(`  Page: ${f.pageUrl}`)
    if (f.evidence?.trim()) lines.push(`  Evidence: ${f.evidence.trim()}`)
    lines.push(`  Attention: ${f.attention ?? 'Not recorded'}`)
    lines.push(`  Guidance contract: ${f.attention === 'recommendation' ? 'Return an inspection plan with an unconfirmed change condition and preserved behavior.' : f.attention === 'flag' ? 'Return a concise task for the established recorded failure.' : 'Not recorded'}`)
    lines.push(`  Recorded cause certainty: ${f.causeCertainty ?? 'Not recorded'}`)
    lines.push(`  Recorded fix confidence: ${f.fixConfidence ?? 'Not recorded'}`)
    lines.push(`  Recorded verificationRule: ${f.verificationRule ?? 'Independent verification conditions are not recorded.'}`)
    const current = quotedCurrentText(f.evidence)
    if (current) lines.push(`  Current text: "${current}"`)
    for (const [index, item] of (f.supportingObservations ?? []).entries()) {
      lines.push(`  Supporting observation ${index + 1}: page=${item.pageUrl ?? 'not recorded'}, source=${item.source ?? 'not recorded'}, check=${item.checkId ?? 'not recorded'}, version=${item.checkVersion ?? 'not recorded'}, recordedAt=${item.recordedAt ?? 'not recorded'}`)
      lines.push(`    Evidence: ${item.evidence}`)
      for (const target of item.references)
        lines.push(`    Target: ${target.device}, ${target.label}${target.selector ? `, selector=${target.selector}` : ''}`)
    }
    return lines.join('\n')
  }).join('\n') || 'None'}

${imageEvidence} Supporting observations on other pages supply their own recorded evidence.${context.validationFeedback ? `

PREVIOUS RESPONSE REJECTED
Server validation error (data): ${JSON.stringify(context.validationFeedback)}
Correct that contract failure and return the complete payload for the same exact admitted identities. Keep the original Attention, diagnosis, observations and verification obligations unchanged. Do not omit a finding, invent a new one or turn an inspection into an unconditional change.` : ''}`
}

/**
 * Back-compat: full prescription prompt as a single string (system + user).
 * Prefer the split builders above at call sites so the system block can be cached.
 */
export function buildPrescriptionPrompt(context: PrescriptionContext): string {
  return `${buildPrescriptionSystemPrompt()}\n\n${buildPrescriptionUserPrompt(context)}`
}
