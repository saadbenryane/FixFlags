import Anthropic from '@anthropic-ai/sdk'

export const QUALITY_REPORT_SCHEMA = {
    type: 'object' as const,
    required: ['pageJob', 'pageType', 'verdict', 'score', 'launchReadiness', 'launchChecklist', 'areas', 'newFindings', 'enrichments'],
    properties: {
      pageJob: {
        type: 'string',
        description: 'One sentence: what job is this page trying to do? e.g. "Convert SaaS visitors into free trial signups"',
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
        description: 'Is this page safe to share publicly? safe = ship it, fix_first = fix top issues first, not_ready = do not post yet',
      },
      launchChecklist: {
        type: 'array',
        description: 'Five binary launch checks',
        items: {
          type: 'object',
          required: ['id', 'label', 'passed'],
          properties: {
            id: { type: 'string', enum: ['https', 'social-preview', 'mobile-cta', 'console-errors', 'privacy-contact'] },
            label: { type: 'string' },
            passed: { type: 'boolean' },
          },
        },
      },
      areas: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'score', 'grade', 'status', 'assessmentState', 'confidence', 'summary', 'areaPrompt'],
          properties: {
            name: {
              type: 'string',
              enum: ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'CONVERSION', 'TRUST', 'CONTENT', 'MOBILE'],
            },
            score: { type: ['number', 'null'], minimum: 0, maximum: 100, description: 'Score 0-100 when assessed; null only when evidence is unavailable' },
            grade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
            status: { type: 'string', enum: ['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'CRITICAL'] },
            assessmentState: { type: 'string', enum: ['ASSESSED', 'PARTIAL', 'UNKNOWN'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            summary: { type: 'string', description: '2-3 sentences describing issues and impact' },
            areaPrompt: {
              type: 'string',
              description: 'A holistic prompt that fixes ALL issues in this area at once. Must be specific, actionable, reference actual content from the page, and be ready to paste into an AI coding agent.',
            },
            cursorPrompt: { type: 'string' },
            claudePrompt: { type: 'string' },
            lovablePrompt: { type: 'string' },
            boltPrompt: { type: 'string' },
          },
        },
      },
      newFindings: {
        type: 'array',
        description: '2-4 AI-only findings for things deterministic rules cannot catch (conversion, content quality, UX issues visible in screenshots)',
        items: {
          type: 'object',
          required: ['area', 'severity', 'problem', 'evidence', 'whyItMatters', 'fix', 'confidence'],
          properties: {
            area: { type: 'string', enum: ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'CONVERSION', 'TRUST', 'CONTENT', 'MOBILE'] },
            severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] },
            problem: { type: 'string' },
            evidence: { type: 'string' },
            whyItMatters: { type: 'string', description: '1-2 sentences explaining the real-world business impact' },
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
        description: 'One enrichment per deterministic finding checkId — adds whyItMatters and agent-specific prompts',
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
  deterministicFindings: Array<{ checkId: string; problem: string; evidence: string; area: string; severity: string }>
}): string {
  return `You are QualityOS, a world-class website quality auditor for the vibe coding community.

Your job: analyze this website and produce a structured quality report that helps AI-assisted developers understand and fix every quality issue.

CRITICAL: The area prompts (areaPrompt, cursorPrompt, etc.) are the MOST IMPORTANT output. They must be:
- Specific to THIS website (reference actual content, actual headings, actual CTA text)
- Complete (fix ALL issues in the area, not just one)
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

Deterministic findings already identified (enrich these — do not duplicate them as new findings):
${context.deterministicFindings.map((f) => `[${f.severity}] ${f.checkId}: ${f.problem}`).join('\n') || 'None'}

You have been given ${context.screenshotHint === 'desktop-only' ? 'a desktop screenshot' : 'desktop and mobile screenshots'}. Use ${context.screenshotHint === 'desktop-only' ? 'it' : 'them'} to:
1. Identify the page type and job
2. Judge conversion quality (CTA placement, value prop clarity, trust signals)
3. Judge content quality (specific vs generic copy, headline effectiveness)
4. Identify visual/UX issues the rules couldn't catch
5. Write area prompts that reference EXACTLY what you see in the screenshots

Grade benchmarks (use same thresholds for every area):
- A >=90, B >=75, C >=60, D >=40, F below 40
- ACCESSIBILITY nuance: A = zero violations, B = 1-2 minor, C = missing alts/labels, D/F = critical failures
- SEO nuance: A = all tags + structured data, B = 1-2 missing, C = missing desc or multiple H1, D/F = no title or noindex
- CONVERSION/TRUST/CONTENT: grade by what you see in screenshots and page text

IMPORTANT: If you grade an area B or below, you MUST include at least one finding in newFindings for that area (or rely on deterministic findings). Never give a poor grade with zero findings — the summary alone is not enough for builders to act.

Every newFinding and every enrichment MUST include a verificationRule: a concrete, testable check to confirm the fix (e.g. "og:image returns 200 and preview shows image in Slack").

PROMPT RULES — no speculation:
- Never use "likely", "probably", or guess file paths (_app.tsx, layout.tsx) unless deterministic evidence names the file.
- Never invent CTR, conversion, or revenue impact ranges unless supplied in the evidence above.
- Reference only DOM elements, Lighthouse audit IDs, or content visible in screenshots/page text.
- Every fix prompt must state how to verify the change worked.

Set launchReadiness based on whether embarrassing or conversion-critical issues remain. launchChecklist must include exactly 5 items: HTTPS, social preview (og:image), mobile CTA visible, no critical console errors, privacy/contact link present — mark passed/failed from evidence.

Return ALL 7 unique area entries. Use the same score-to-grade thresholds for every area: A >=90, B >=75, C >=60, D >=40, F below 40. Mark assessmentState ASSESSED only when a score is supported by the supplied evidence; otherwise use PARTIAL or UNKNOWN with a null score. Never invent positive evidence.

The launch checklist IDs must be exactly: https, social-preview, mobile-cta, console-errors, privacy-contact. Return exactly one enrichment for every deterministic checkId and no enrichment for any other ID.`
}
