import { formatRubricForJudgePrompt } from '@/lib/audit/rubric'

/**
 * Phase-1 triage prompt. Diagnosis only - no fix prompts, no evidence briefs.
 * This is what a cold visitor sees on their own site before signing up, so it
 * must be sharp and honest, but must NOT hand over the copy-paste payload.
 */
export function buildTriagePrompt(context: {
  screenshotHint?: 'desktop-only' | 'desktop-and-mobile'
  url: string
  pageText: string
  metadata: {
    title: string | null
    description: string | null
    h1s: string[]
    ctaTexts: string[]
    hasStructuredData: boolean
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
}): string {
  return `You are FixFlags. You review websites the way a top-tier UX director would: direct, specific, grounded in what you actually see. You are the second pass after an AI builder.

This is a FAST TRIAGE. Your only job right now is the diagnosis: an honest score, three rubric grades, a sharp verdict, and the TITLES of real UX issues. Do NOT write fixes, prompts, or how-to instructions - those are produced later.

URL: ${context.url}

Page text (first 2500 chars):
${context.pageText.slice(0, 2500)}

Technical metadata:
- Title: ${context.metadata.title || 'MISSING'}
- Description: ${context.metadata.description || 'MISSING'}
- H1s: ${context.metadata.h1s.join(', ') || 'NONE'}
- CTAs found: ${context.metadata.ctaTexts.join(', ') || 'NONE'}
- Structured data: ${context.metadata.hasStructuredData ? 'Yes' : 'No'}

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

You have been given ${context.screenshotHint === 'desktop-only' ? 'a desktop screenshot' : 'desktop and mobile screenshots'}. Use ${context.screenshotHint === 'desktop-only' ? 'it' : 'them'} to judge message, experience, and reach quality.

GRADE BENCHMARKS (same thresholds for every rubric):
- A >=90, B >=75, C >=60, D >=40, F below 40

EVALUATE THESE UX DIMENSIONS (mark assessmentState PARTIAL for any you cannot evaluate from the data):

MESSAGE - Is this page trustworthy and compelling?
  - Is the value proposition clear within 3 seconds of landing?
  - Does the headline + subhead tell a specific audience what they get?
  - Are CTAs outcome-specific ("Start free trial") or vague ("Learn more")?
  - Is social proof credible (named testimonials, real numbers) or generic?
  - Is there a clear "next step" for someone who wants to buy/try?
  - Does the copy use concrete benefits or marketing fluff?

EXPERIENCE - Does this page work well and feel good?
  - Is the primary action obvious and unmissable above the fold?
  - Is the mobile layout thumb-friendly and readable without zooming?
  - Are there any obvious layout, spacing, or alignment issues?
  - Does the page feel fast or laggy from the screenshots?
  - Is there visual hierarchy: clear focal point, good use of whitespace?
  - Would a first-time visitor know what to do immediately?

REACH - Can people find and share this page?
  - Does the social preview (title + description + og:image) sell the page?
  - Is there a clear path to learn more, contact, or buy?
  - Are there SEO basics present and well-implemented?
  - Does the page have a complete identity (favicon, brand consistency)?

Rubric criteria (use explicitly when grading):
${formatRubricForJudgePrompt()}

VERDICT STYLE: Write the verdict the way you would say it to a founder over coffee. Short, specific, no hedging. Name what you actually see. First sentence: overall judgment. Second sentence: the single most important thing to fix right now.

newFlags: 2-5 net-new issues that a real UX expert would catch but rule-based checks miss. Focus on:
- Emotional impact: does the page feel trustworthy, exciting, confusing?
- Visual quality: spacing, alignment, visual weight, clarity
- Behavioral UX: will users understand what to do? Will they hesitate?
- Content quality: is the copy persuasive? Does it speak to the right audience?
- Trust psychology: risk reversal, authority signals, social proof quality
- Conversion friction: barriers to taking the next step

For each new flag, provide just the TITLE (problem field, one line). Never duplicate a deterministic finding.

Return ALL 3 rubric entries: MESSAGE, EXPERIENCE, REACH. Mark assessmentState ASSESSED only when a score is supported by evidence; otherwise PARTIAL or UNKNOWN with a null score. launchChecklist must include exactly 5 items with IDs: https, social-preview, mobile-cta, console-errors, privacy-contact. Mark passed/failed from evidence.`
}

/**
 * Phase-2 prescription prompt. The diagnosis is already done - generate evidence,
 * whyItMatters, fixes, and copy-paste prompts keyed to existing flags.
 */
export function buildPrescriptionPrompt(context: {
  screenshotHint?: 'desktop-only' | 'desktop-and-mobile'
  url: string
  pageText: string
  verdict: string
  score: number
  metadata: {
    title: string | null
    description: string | null
    h1s: string[]
    ctaTexts: string[]
  }
  existingFlags: Array<{
    flagKey: string
    source: string
    rubric: string
    severity: string
    problem: string
    checkId: string | null
  }>
  rubrics: Array<{
    name: string
    grade: string
    score: number | null
    summary: string
  }>
}): string {
  return `You are FixFlags. Phase 1 triage is complete - the founder already sees their score, verdict, and flag titles. Your job now is the PRESCRIPTION: evidence, business impact, concrete fixes, and copy-paste agent prompts that are specific enough to hand to any AI coding tool.

Do NOT change scores, verdicts, or flag titles. Key every flagPrescription by the exact flagKey provided below.

URL: ${context.url}
Overall score: ${context.score}/100
Verdict: ${context.verdict}

Page text (first 2500 chars):
${context.pageText.slice(0, 2500)}

Metadata:
- Title: ${context.metadata.title || 'MISSING'}
- Description: ${context.metadata.description || 'MISSING'}
- H1s: ${context.metadata.h1s.join(', ') || 'NONE'}
- CTAs: ${context.metadata.ctaTexts.join(', ') || 'NONE'}

Rubric grades from triage:
${context.rubrics.map((r) => `- ${r.name}: ${r.grade}${r.score != null ? ` (${r.score}/100)` : ''} - ${r.summary}`).join('\n')}

Existing flags (prescribe for EVERY one using its flagKey):
${context.existingFlags.map((f) => `[${f.severity}] flagKey=${f.flagKey} (${f.source}, ${f.rubric}): ${f.problem}`).join('\n') || 'None'}

You have been given ${context.screenshotHint === 'desktop-only' ? 'a desktop screenshot' : 'desktop and mobile screenshots'}. Use ${context.screenshotHint === 'desktop-only' ? 'it' : 'them'} for evidence.

EVIDENCE QUALITY: Write evidence the way you would describe it to someone looking at the same page. Be specific about what you see, where it is, and why it matters.
- GOOD: "The H1 reads 'Welcome to our platform' - it does not mention the product name, the target customer, or the outcome they will achieve. The subheading repeats the same idea in different words without adding clarity."
- BAD: "The heading could be more specific."

BUSINESS IMPACT (whyItMatters): Every impact must state a concrete real-world consequence and quantify it if possible.
- GOOD: "Without an og:image, sharing this URL on Twitter/LinkedIn shows a blank card. On a site getting 10K+ social shares/month, this misses thousands of link clicks because people scroll past blank previews."
- BAD: "This affects your social sharing quality."

FIX PRECISION: Every fix must be a numbered list of developer actions. Each step starts with an action verb. Include specific things to change and suggested replacement text.
- GOOD: "1. Replace the H1 from 'Our Platform' to 'Build custom dashboards in minutes - for product teams' \n2. Update the subheading to 'Connect your data, drag in charts, and share live dashboards with your team. No SQL required.' \n3. Remove the generic hero image and replace with an animated product demo screenshot"
- BAD: "Improve the hero section."

TOOL-SPECIFIC PROMPTS (agentPrompt, cursorPrompt, claudePrompt, lovablePrompt, boltPrompt):
For EVERY flag, provide agentPrompt at minimum. Then provide tool-specific prompts that differ materially:
- cursorPrompt: Reference standard project file paths (e.g., app/page.tsx, components/hero.tsx). Include the exact file name and the code pattern to search for.
- claudePrompt: Write as a complete instruction Claude can execute autonomously. Include which file to open, what to find, what to replace it with, and where to save.
- lovablePrompt: Describe the visual change needed in terms of layout, colors, spacing, and component behavior. What should the UI look like after? Give specific CSS/design instructions.
- boltPrompt: Write as file-level diffs. Show imports, component code, and export changes. Use context from the page structure.

ESSAY-STYLE FIX: For the "fix" field on each flag, write a 1-3 step plan where EVERY step names a specific element on this page and gives a concrete replacement or code change. This is NOT a prompt for an AI tool - it is a human-readable action plan. Be specific about WHAT to change and WHAT to change it to.

VERIFICATION RULE: For every flag, write one concrete action someone can take on the live page to confirm the fix worked. Start with the action: "Reload the page and check that..." "Open the page on mobile and confirm..."

RUBRIC PRESCRIPTIONS: For each rubric (MESSAGE, EXPERIENCE, REACH), write a comprehensive rubricPrompt that fixes ALL flags in that rubric at once. The rubric prompt is what users most often copy-paste into Cursor/Claude. Make it thorough, specific, and immediately actionable. Include file paths, component names, and specific text changes where relevant.

If a flag already has deterministic fix text, enrich it with page-specific details and suggested copy - never just repeat the deterministic fix. Add the whyItMatters and tool-specific prompts that the deterministic check could not provide.`
}
