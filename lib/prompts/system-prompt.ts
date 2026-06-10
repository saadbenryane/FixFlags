import Anthropic from '@anthropic-ai/sdk'

export const QUALITY_REPORT_TOOL: Anthropic.Tool = {
  name: 'quality_report',
  description: 'Output a structured quality audit report for a website',
  input_schema: {
    type: 'object' as const,
    required: ['pageJob', 'pageType', 'verdict', 'score', 'areas', 'newFindings', 'enrichments'],
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
      areas: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'grade', 'status', 'summary', 'areaPrompt'],
          properties: {
            name: {
              type: 'string',
              enum: ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'CONVERSION', 'TRUST', 'CONTENT', 'MOBILE'],
            },
            score: { type: 'number', description: 'Score 0-100, null for CONVERSION/TRUST/CONTENT' },
            grade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
            status: { type: 'string', enum: ['EXCELLENT', 'GOOD', 'NEEDS_WORK', 'CRITICAL'] },
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
          required: ['area', 'severity', 'problem', 'evidence', 'fix', 'confidence'],
          properties: {
            area: { type: 'string', enum: ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'CONVERSION', 'TRUST', 'CONTENT', 'MOBILE'] },
            severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] },
            problem: { type: 'string' },
            evidence: { type: 'string' },
            fix: { type: 'string' },
            confidence: { type: 'number' },
            agentPrompt: { type: 'string' },
            cursorPrompt: { type: 'string' },
            claudePrompt: { type: 'string' },
            lovablePrompt: { type: 'string' },
            boltPrompt: { type: 'string' },
            verificationRule: { type: 'string' },
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
  },
}

export function buildJudgePrompt(context: {
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

You have been given two screenshots (desktop and mobile). Use them to:
1. Identify the page type and job
2. Judge conversion quality (CTA placement, value prop clarity, trust signals)
3. Judge content quality (specific vs generic copy, headline effectiveness)
4. Identify visual/UX issues the rules couldn't catch
5. Write area prompts that reference EXACTLY what you see in the screenshots

Grade benchmarks:
- PERFORMANCE: A (≥90), B (75-89), C (50-74), D/F (<50)
- ACCESSIBILITY: A (zero violations), B (1-2 minor), C (missing alts/labels), D/F (critical failures)
- SEO: A (all tags + structured data), B (1-2 missing), C (missing desc or multiple H1), D/F (no title or noindex)
- CONVERSION/TRUST/CONTENT: grade by what you see in screenshots and page text

Return ALL 7 area entries. For areas with no issues, grade A with a positive summary.`
}
