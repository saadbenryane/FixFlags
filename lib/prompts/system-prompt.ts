import Anthropic from '@anthropic-ai/sdk'
import { formatRubricForJudgePrompt } from '@/lib/audit/rubric'

export const QUALITY_REPORT_SCHEMA = {
  type: 'object' as const,
  required: [
    'pageJob',
    'pageType',
    'verdict',
    'score',
    'launchReadiness',
    'launchChecklist',
    'rubrics',
    'newFlags',
    'enrichments',
  ],
  properties: {
    pageJob: {
      type: 'string',
      description:
        'One sentence: what job is this page trying to do? e.g. "Convert SaaS visitors into free trial signups"',
    },
    pageType: {
      type: 'string',
      enum: ['homepage', 'pricing', 'landing', 'dashboard', 'portfolio', 'article', 'other'],
    },
    verdict: {
      type: 'string',
      description: 'Two sentences: overall judgment of the page quality and most important issue',
    },
    score: {
      type: 'number',
      description: 'Overall quality score 0-100',
    },
    launchReadiness: {
      type: 'string',
      enum: ['safe', 'fix_first', 'not_ready'],
      description:
        'Is this page safe to share publicly? safe = ship it, fix_first = fix top issues first, not_ready = do not post yet',
    },
    launchChecklist: {
      type: 'array',
      description: 'Five binary launch checks',
      items: {
        type: 'object',
        required: ['id', 'label', 'passed'],
        properties: {
          id: {
            type: 'string',
            enum: ['https', 'social-preview', 'mobile-cta', 'console-errors', 'privacy-contact'],
          },
          label: { type: 'string' },
          passed: { type: 'boolean' },
        },
      },
    },
    rubrics: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'score', 'grade', 'status', 'assessmentState', 'confidence', 'summary', 'rubricPrompt'],
        properties: {
          name: {
            type: 'string',
            enum: ['MESSAGE', 'EXPERIENCE', 'REACH'],
          },
          score: {
            type: ['number', 'null'],
            minimum: 0,
            maximum: 100,
            description: 'Score 0-100 when assessed; null only when evidence is unavailable',
          },
          grade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
          status: { type: 'string', enum: ['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'CRITICAL'] },
          assessmentState: { type: 'string', enum: ['ASSESSED', 'PARTIAL', 'UNKNOWN'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          summary: { type: 'string', description: '2-3 sentences describing issues and impact' },
          rubricPrompt: {
            type: 'string',
            description:
              'A holistic prompt that fixes ALL flags in this rubric at once. Must be specific, actionable, reference actual content from the page, and be ready to paste into an AI coding agent.',
          },
          cursorPrompt: { type: 'string' },
          claudePrompt: { type: 'string' },
          lovablePrompt: { type: 'string' },
          boltPrompt: { type: 'string' },
        },
      },
    },
    newFlags: {
      type: 'array',
      description:
        '2-4 AI-only flags for things deterministic rules cannot catch (conversion, content quality, UX issues visible in screenshots)',
      items: {
        type: 'object',
        required: ['rubric', 'impactTag', 'severity', 'problem', 'evidence', 'whyItMatters', 'fix', 'confidence'],
        properties: {
          rubric: { type: 'string', enum: ['MESSAGE', 'EXPERIENCE', 'REACH'] },
          impactTag: {
            type: 'string',
            enum: ['CONVERSION', 'REVENUE', 'TRUST', 'MEASUREMENT', 'SHARING', 'SEO', 'ACCESSIBILITY'],
          },
          severity: { type: 'string', enum: ['CRITICAL', 'IMPORTANT', 'POLISH'] },
          problem: { type: 'string' },
          evidence: { type: 'string' },
          whyItMatters: {
            type: 'string',
            description: '1-2 sentences explaining the real-world business impact',
          },
          fix: { type: 'string' },
          confidence: { type: 'number' },
          agentPrompt: { type: 'string' },
          cursorPrompt: { type: 'string' },
          claudePrompt: { type: 'string' },
          lovablePrompt: { type: 'string' },
          boltPrompt: { type: 'string' },
          verificationRule: { type: 'string' },
          pageUrl: { type: 'string' },
        },
      },
    },
    enrichments: {
      type: 'array',
      description: 'One enrichment per deterministic flag checkId, adds whyItMatters and agent-specific prompts',
      items: {
        type: 'object',
        required: ['checkId', 'whyItMatters'],
        properties: {
          checkId: { type: 'string' },
          whyItMatters: { type: 'string', description: '1-2 sentences explaining the real-world impact' },
          agentPrompt: { type: 'string' },
          cursorPrompt: { type: 'string' },
          claudePrompt: { type: 'string' },
          lovablePrompt: { type: 'string' },
          boltPrompt: { type: 'string' },
          verificationRule: { type: 'string', description: 'How to verify this is fixed' },
        },
      },
    },
  },
} as const

export const QUALITY_REPORT_TOOL: Anthropic.Tool = {
  name: 'quality_report',
  description: 'Output a structured quality audit report for a website',
  input_schema: QUALITY_REPORT_SCHEMA,
}

export function buildJudgePrompt(context: {
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
  return `You are FixFlags, a sharp senior reviewer for builders shipping with AI coding tools.

Your job: analyze this website and produce a structured FixFlags report that helps AI-assisted developers understand and fix every quality issue.

CRITICAL: The rubric prompts (rubricPrompt, cursorPrompt, etc.) are the MOST IMPORTANT output. They must be:
- Specific to THIS website (reference actual content, actual headings, actual CTA text)
- Complete (fix ALL flags in the rubric, not just one)
- Ready to paste directly into an AI coding agent
- Actionable (tell the agent exactly what to change and what to preserve)

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

Deterministic flags already identified (enrich these, do not duplicate them as new flags):
${context.deterministicFlags.map((f) => `[${f.severity}] ${f.checkId} (${f.rubric}): ${f.problem}`).join('\n') || 'None'}

You have been given ${context.screenshotHint === 'desktop-only' ? 'a desktop screenshot' : 'desktop and mobile screenshots'}. Use ${context.screenshotHint === 'desktop-only' ? 'it' : 'them'} to:
1. Identify the page type and job
2. Judge message quality (value prop clarity, headline specificity, trust signals)
3. Judge experience quality (CTA placement, mobile usability, visual polish)
4. Judge reach quality (share preview, SEO basics, contact/privacy discoverability)
5. Write rubric prompts that reference EXACTLY what you see in the screenshots

Grade benchmarks (use same thresholds for every rubric):
- A >=90, B >=75, C >=60, D >=40, F below 40
- MESSAGE nuance: A = specific value prop + credible trust, B = minor copy gaps, C = vague hero or weak CTA, D/F = generic or misleading
- EXPERIENCE nuance: A = fast, accessible, clear CTA on mobile, B = 1-2 UX gaps, C = mobile CTA hidden or a11y basics missing, D/F = broken flows or critical perf/a11y failures
- REACH nuance: A = complete metadata + share preview + indexable, B = 1-2 missing tags, C = missing description or weak og:image, D/F = no title, noindex, or no contact/privacy path

Rubric criteria (use explicitly when grading):
${formatRubricForJudgePrompt()}

Flag severity guide:
- CRITICAL = blocks launch or embarrasses you publicly
- IMPORTANT = hurts conversion, trust, or shareability
- POLISH = worth fixing but not launch-blocking

IMPORTANT: If you grade a rubric B or below, you MUST include at least one flag in newFlags for that rubric (or rely on deterministic flags). Never give a poor grade with zero flags. The summary alone is not enough for builders to act.

Every newFlag and every enrichment MUST include a verificationRule: a concrete, testable check to confirm the fix (e.g. "og:image returns 200 and preview shows image in Slack").

PROMPT RULES, no speculation:
- Never use "likely", "probably", or guess file paths (_app.tsx, layout.tsx) unless deterministic evidence names the file.
- Never invent CTR, conversion, or revenue impact ranges unless supplied in the evidence above.
- Reference only DOM elements, Lighthouse audit IDs, or content visible in screenshots/page text.
- Every fix prompt must state how to verify the change worked.

Set launchReadiness based on whether embarrassing or conversion-critical flags remain. launchChecklist must include exactly 5 items: HTTPS, social preview (og:image), mobile CTA visible, no critical console errors, privacy/contact link present. Mark passed/failed from evidence.

Return ALL 3 rubric entries: MESSAGE, EXPERIENCE, REACH. Use the same score-to-grade thresholds for every rubric: A >=90, B >=75, C >=60, D >=40, F below 40. Mark assessmentState ASSESSED only when a score is supported by the supplied evidence; otherwise use PARTIAL or UNKNOWN with a null score. Never invent positive evidence.

The launch checklist IDs must be exactly: https, social-preview, mobile-cta, console-errors, privacy-contact. Return exactly one enrichment for every deterministic checkId and no enrichment for any other ID.`
}
