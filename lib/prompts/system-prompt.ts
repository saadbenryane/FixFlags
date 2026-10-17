import { formatRubricForJudgePrompt } from '@/lib/audit/rubric'
import { TRIAGE_TEXT, PRESCRIPTION_TEXT } from '@/lib/audit/page-text-limits'

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
- copy-clarity needs a headline or pageText reference. Review its supporting context and page purpose.
- action-clarity needs a ctaText reference. Review the wording, without inventing a click, submission, destination or failure.
- visual-hierarchy needs two distinct ctaText references and an actually supplied screenshot on the declared device. This is a review of prominence, not proof of competing actions, hidden controls, confusion or conversion loss.
- search-snippet needs a title or description reference and rubric REACH. Review wording, not ranking, authenticity or observed search results.
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
  screenshotHint?: 'no-screenshot' | 'desktop-only' | 'mobile-only' | 'desktop-and-mobile'
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
  return `You are FixFlags. Phase 1 triage is complete. The founder already sees their score, verdict, flag titles, evidence, and why it matters. Your job now is the PRESCRIPTION: concrete fixes and copy-paste agent prompts grounded in those recorded observations.

Do NOT change scores, verdicts, flag titles, evidence, whyItMatters, or verification obligations. Key every flagPrescription by the exact flagKey provided in the request. The compatibility fields evidence, whyItMatters, and verificationRule repeat their recorded values; they do not authorize a new diagnosis and are not persisted from this phase.

EVIDENCE BOUNDARY: Use the recorded element, text, attribute, page, device, and target. A screenshot of one page is not evidence about another page. Do not infer absence from truncated content. If a field or observation is unavailable, say that it is not recorded. Keep Recommendations conditional. Do not invent traffic, revenue, abandonment, conversion, ranking, legal compliance, user behavior, or measured business outcomes. An observed technical condition does not measure those outcomes.

FIX PRECISION: The "fix" field and agentPrompt are a TASK BODY, not a complete editor prompt and not a code patch. FixFlags did not open the repository. Name the live element, its current text or value, and the desired outcome.
- GOOD: "Replace the H1 that currently reads 'Welcome to our platform' with a concise audience-and-outcome statement. Leave the subheading and CTA unchanged."
- GOOD: "Keep the primary CTA visible in the first 812px at 375px width. Do not rewrite the offer copy."
- BAD: "Improve the hero section."
- BAD: "Make the copy more compelling."
- BAD: "In app/page.tsx, change the H1."
- RULE: Do not invent file paths, @file references, or unified diffs. The copy-time handoff tells the editor to search for the current text.
- SELF-CHECK: Could someone grep the repo for the current text you named? If no, rewrite it.

agentPrompt (REQUIRED): One short task stating current to desired for the named element. No Goal/Constraint/Plan headers. No file paths.
  EXAMPLE: "Replace the H1 that reads 'Welcome to our platform' with a concise audience-and-outcome statement. Keep the existing subheading and CTA."

Omit cursorPrompt, claudePrompt, windsurfPrompt, lovablePrompt, and boltPrompt. A later assembler wraps agentPrompt into a tool-agnostic editor handoff.

ESSAY-STYLE FIX: For the "fix" field, write imperative steps only. Do NOT nest ## Goal / ## Observed / ## Expected / ## How to verify headers inside fix. Every fix MUST:

1. Name the element to change
2. State current text/value/behavior
3. State the expected text/value/behavior after the fix
4. Stay concise (prefer under 8 lines)
5. Avoid invented file paths

EXAMPLE:
Change the hero H1 from "Welcome to our platform" to an audience-and-outcome statement. Keep the surrounding layout unchanged.

RULE: Before writing, identify the current state from the evidence. Then state the target state. Be specific about WHAT to change and WHAT to change it to.

VERIFICATION RULE: Repeat the recorded verification rule without narrowing any original page, device, target, or failure mechanism. If unavailable, state "Independent verification conditions are not recorded." Repair instructions may explain how to inspect the same condition, but cannot substitute a score or unrelated successful action for that condition.
- GOOD: "Reload the page at the recorded viewport and inspect the original button's accessible name."
- BAD: "Run an audit and reach an Accessibility score of 90."

RUBRIC PRESCRIPTIONS: For each rubric (MESSAGE, EXPERIENCE, REACH), write a comprehensive rubricPrompt that fixes ALL flags in that rubric at once.
- Return rubricPrescriptions as an object with exactly MESSAGE, EXPERIENCE, and REACH as required keys. Each value contains the prescription without repeating name.
- If a rubric has no admitted findings, state that no change is prescribed from the available evidence. Do not invent an issue or a fix to fill the rubric.
- A grouped Flag can contain multiple recorded supporting observations. Address every listed page, device, and target, keeping different conditions distinguishable. Do not prescribe only its representative observation or infer that missing evidence passed.
- Structure the rubric prompt as a numbered list of changes, one per flag
- Each step: name the element, current text, replacement text
- Include a "Do NOT change" section listing sections or elements that should be left alone
- End with a verification step on the live page
- Do not invent file paths

SCOPE GUARD: Every agentPrompt and every rubric prompt MUST include a "Do NOT change" or scope sentence. Name the sections or elements that should be left untouched, not files you have not seen. This is as important as the fix itself.

Use existing fix text as the starting point. Add only details supported by the recorded observations. Do not invent replacement product promises or quantified claims. Keep the original diagnosis and every verification obligation intact.`
}

export interface PrescriptionContext {
  screenshotHint?: 'desktop-only' | 'desktop-and-mobile'
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
  existingFlags: Array<{
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
  return `URL: ${context.url}
Overall score: ${context.score}/100
Verdict: ${context.verdict}

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

Rubric grades from triage:
${context.rubrics.map((r) => `- ${r.name}: ${r.grade ?? 'Not graded'}${r.score != null ? ` (${r.score}/100)` : ''} - ${r.summary}`).join('\n')}

Existing flags (return flagPrescriptions as an object with every unique exact flagKey below as a required property; each value contains its prescription, without repeating flagKey inside it):
${context.existingFlags.map((f) => {
    const lines = [`[${f.severity}] flagKey=${f.flagKey} (${f.source}, ${f.rubric}): ${f.problem}`]
    if (f.pageUrl) lines.push(`  Page: ${f.pageUrl}`)
    if (f.evidence?.trim()) lines.push(`  Evidence: ${f.evidence.trim()}`)
    lines.push(`  Recorded whyItMatters: ${f.whyItMatters ?? 'Not recorded'}`)
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

You have been given ${context.screenshotHint === 'desktop-only' ? 'a desktop screenshot' : 'desktop and mobile screenshots'}. Use ${context.screenshotHint === 'desktop-only' ? 'it' : 'them'} for evidence. The attached screenshots belong to the URL above. Supporting observations on other pages supply their own recorded evidence; do not treat these screenshots as captures of those pages.`
}

/**
 * Back-compat: full prescription prompt as a single string (system + user).
 * Prefer the split builders above at call sites so the system block can be cached.
 */
export function buildPrescriptionPrompt(context: PrescriptionContext): string {
  return `${buildPrescriptionSystemPrompt()}\n\n${buildPrescriptionUserPrompt(context)}`
}
