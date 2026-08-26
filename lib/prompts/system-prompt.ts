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

MESSAGE - Does the page make the visitor feel understood and compelled to act?
  - Does the hero answer "what is this?" AND "why should I care?" in under 3 seconds?
  - Does the headline + subhead pair name a specific audience, a concrete outcome, and a believable mechanism?
  - Are CTAs outcome-specific ("Start free trial", "Get my audit") or generic ("Learn more", "Get started")?
  - Is social proof specific (named people, verifiable numbers, attributed quotes) or templated?
  - Does the page explicitly state who this is NOT for, or is it trying to appeal to everyone?
  - Does the copy use concrete, sensory language or abstract marketing abstractions?
  - Is there a clear hierarchy of value: one core promise, then supporting proof, then the ask?

EXPERIENCE - Does the page feel professional, trustworthy, and easy to use?
  - Does the page pass the 5-second glance test: is the purpose and primary action immediately obvious?
  - Is the mobile layout built for one-handed use, or does it require stretching and zooming?
  - Are there obvious alignment, spacing, or density issues that look builder-generated?
  - Does the page feel fast from the screenshots, or is there blank space, loading states, or layout shift visible?
  - Is the visual hierarchy clear: one focal point, supporting elements visually subordinate, good whitespace?
  - Would a first-time visitor from a cold link know what to do within 3 seconds?
  - Are there any visual elements that look broken, misaligned, or inconsistent with the brand?

REACH - Can the right people find, share, and trust this page?
  - Does the social preview (title + description + og:image) accurately sell the page's value to someone who has never heard of the product?
  - Is there a clear path to learn more, contact, or convert at every stage of awareness?
  - Are SEO fundamentals present and competently implemented?
  - Does the page look complete: favicon, brand identity, consistent typography, no unfinished elements?
  - Would a first-time visitor who found this through a search result or social share trust it enough to engage?

Rubric criteria (use explicitly when grading):
${formatRubricForJudgePrompt()}

VERDICT STYLE: Write the verdict the way you would say it to a founder over coffee. Short, specific, no hedging. Name what you actually see. First sentence: overall judgment. Second sentence: the single most important thing to fix right now.

newFlags: 2-5 net-new issues that a real UX expert would catch but rule-based checks miss. Prioritize by business impact:
- 🥇 Conversion killers: anything that blocks or confuses the primary action (signup, purchase, trial)
- 🥈 Trust destroyers: anything that makes the page feel unfinished, dishonest, or risky
- 🥉 Polish gaps: visual inconsistencies, scannability issues, friction points

Evaluate these un-pattern-checkable dimensions:
- Emotional UX: does the page feel trustworthy, exciting, or confusing on first impression?
- Visual quality: spacing, alignment, visual weight, font pairing, color harmony
- Behavioral UX: will users hesitate? Is the path to value obvious?
- Content quality: is the copy persuasive at each stage of awareness?
- Trust psychology: risk reversal, authority signals, social proof genuineness
- Conversion friction: barriers between "interested" and "acting"
- Mobile emotional UX: does the mobile layout feel equally considered, not just squished?

TITLE CRAFTING RULES:
- Start with a verb naming what is wrong: "Hero CTA sends users to a dead page" not "Dead page issue"
- Include the specific element name: "Headline uses no audience signal" not "Messaging problem"
- Omit markdown, quotes, punctuation at end
- Never duplicate a deterministic finding - if the slop checker already flagged placeholder copy, do not flag "copy is generic" again
- Browser geometry, console errors, and metadata presence are deterministic truth. Never create a new flag claiming a CTA is hidden/below-fold, console errors are present, privacy/contact information is missing, cookie consent is absent, or share buttons are missing; those are owned by deterministic checks and supplied facts. A marketing site does not need visible share buttons when its social metadata is valid.

For each new flag, provide: problem (one-line title), evidence (1-2 sentences quoting what you see), and whyItMatters (1-2 sentences of impact). Do NOT write fixes, verification steps, or editor prompts in this phase.

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
  return `You are FixFlags. Phase 1 triage is complete - the founder already sees their score, verdict, flag titles, evidence, and why it matters. Your job now is the PRESCRIPTION: sharpened evidence when needed, concrete fixes, and copy-paste agent prompts that are specific enough to hand to any AI coding tool.

Do NOT change scores, verdicts, or flag titles. Key every flagPrescription by the exact flagKey provided in the request.

EVIDENCE QUALITY: Write evidence the way you would describe it to someone looking at the same page. Be specific: what element, where on the page, what it currently says, why it is wrong.
- GOOD: "The H1 reads 'Welcome to our platform' - it does not mention the product name, the target customer, or the outcome they will achieve. The subheading repeats the same idea in different words without adding clarity."
- GOOD: "The meta description is empty, so Google will auto-generate a snippet from page content that says 'Click here to learn more' - a generic phrase that gives no reason to click."
- GOOD: "The primary CTA button says 'Submit' and is positioned below a form with 7 required fields. The button is gray which makes it look disabled."
- BAD: "The heading could be more specific."
- BAD: "The meta tags need improvement."
- BAD: "There are accessibility issues."
- CRITICAL RULE: Name the element type (H1, button, meta tag, image, section), its current text/value, and what makes it wrong. Include the exact text or attribute value you see.

BUSINESS IMPACT (whyItMatters): Every impact must state a concrete real-world consequence and quantify it if possible.
- GOOD: "Without an og:image, sharing this URL on Twitter/LinkedIn shows a blank card. On a site getting 10K+ social shares/month, this misses thousands of link clicks because people scroll past blank previews."
- BAD: "This affects your social sharing quality."
- BETTER: "No og:image means every shared link on LinkedIn, Slack, and iMessage shows a blank preview card. For a product relying on word-of-mouth, this kills the social sharing loop - people skip past blank cards without clicking."

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

VERIFICATION RULE: For every flag, write one concrete action someone can take on the live page to confirm the fix worked. Start with an action verb.
- GOOD: "Reload the page and check that the headline now reads 'Build internal tools 10x faster - for engineering teams'"
- GOOD: "Open the page on a 375px wide viewport and confirm the CTA is visible without scrolling"
- GOOD: "View the page source and confirm <meta property='og:image'> points to a valid image URL that loads in a browser tab"
- GOOD: "Run Lighthouse audit and confirm the Accessibility score is now 90+"
- BAD: "Check that the issue is fixed."
- BAD: "Verify the page looks good."
- RULE: The verification must be something a non-technical person can do (reload, resize, view source) or a specific tool command (Lighthouse, curl). Never write "verify" without specifying HOW.

RUBRIC PRESCRIPTIONS: For each rubric (MESSAGE, EXPERIENCE, REACH), write a comprehensive rubricPrompt that fixes ALL flags in that rubric at once.
- Structure the rubric prompt as a numbered list of changes, one per flag
- Each step: name the element, current text, replacement text
- Include a "Do NOT change" section listing sections or elements that should be left alone
- End with a verification step on the live page
- Do not invent file paths

SCOPE GUARD: Every agentPrompt and every rubric prompt MUST include a "Do NOT change" or scope sentence. Name the sections or elements that should be left untouched, not files you have not seen. This is as important as the fix itself.

If a flag already has deterministic fix text, enrich it with page-specific details and suggested copy - never just repeat the deterministic fix. Add the whyItMatters that the deterministic check could not provide. The deterministic fix is a starting point; your job is to make it specific to this URL, this page structure, and these screenshots.`
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
    pageUrl?: string | null
  }>
  rubrics: Array<{
    name: string
    grade: string
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
${context.rubrics.map((r) => `- ${r.name}: ${r.grade}${r.score != null ? ` (${r.score}/100)` : ''} - ${r.summary}`).join('\n')}

Existing flags (prescribe for EVERY one using its flagKey):
${context.existingFlags.map((f) => {
    const lines = [`[${f.severity}] flagKey=${f.flagKey} (${f.source}, ${f.rubric}): ${f.problem}`]
    if (f.pageUrl) lines.push(`  Page: ${f.pageUrl}`)
    if (f.evidence?.trim()) lines.push(`  Evidence: ${f.evidence.trim()}`)
    const current = quotedCurrentText(f.evidence)
    if (current) lines.push(`  Current text: "${current}"`)
    return lines.join('\n')
  }).join('\n') || 'None'}

You have been given ${context.screenshotHint === 'desktop-only' ? 'a desktop screenshot' : 'desktop and mobile screenshots'}. Use ${context.screenshotHint === 'desktop-only' ? 'it' : 'them'} for evidence.`
}

/**
 * Back-compat: full prescription prompt as a single string (system + user).
 * Prefer the split builders above at call sites so the system block can be cached.
 */
export function buildPrescriptionPrompt(context: PrescriptionContext): string {
  return `${buildPrescriptionSystemPrompt()}\n\n${buildPrescriptionUserPrompt(context)}`
}
