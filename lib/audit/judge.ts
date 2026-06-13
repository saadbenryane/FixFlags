import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { QUALITY_REPORT_TOOL, buildJudgePrompt } from '../prompts/system-prompt'
import { PageMetadata } from './metadata'
import { PageSpeedResult } from './pagespeed'
import { DeterministicFinding } from './checks'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const judgeOutputSchema = z.object({
  pageJob: z.string(),
  pageType: z.string(),
  verdict: z.string(),
  score: z.number(),
  areas: z.array(
    z.object({
      name: z.string(),
      score: z.number().optional(),
      grade: z.string(),
      status: z.string(),
      summary: z.string(),
      areaPrompt: z.string(),
      cursorPrompt: z.string().optional(),
      claudePrompt: z.string().optional(),
      lovablePrompt: z.string().optional(),
      boltPrompt: z.string().optional(),
    })
  ),
  newFindings: z.array(
    z.object({
      area: z.string(),
      severity: z.string(),
      problem: z.string(),
      evidence: z.string(),
      whyItMatters: z.string(),
      fix: z.string(),
      confidence: z.number(),
      agentPrompt: z.string().optional(),
      cursorPrompt: z.string().optional(),
      claudePrompt: z.string().optional(),
      lovablePrompt: z.string().optional(),
      boltPrompt: z.string().optional(),
      verificationRule: z.string().optional(),
    })
  ),
  enrichments: z.array(
    z.object({
      checkId: z.string(),
      whyItMatters: z.string(),
      agentPrompt: z.string().optional(),
      cursorPrompt: z.string().optional(),
      claudePrompt: z.string().optional(),
      lovablePrompt: z.string().optional(),
      boltPrompt: z.string().optional(),
      verificationRule: z.string().optional(),
    })
  ),
})

export type JudgeOutput = z.infer<typeof judgeOutputSchema>

export function isRetryableJudgeError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.name === 'AbortError') return true
  const message = err.message.toLowerCase()
  return (
    message.includes('overloaded') ||
    message.includes('rate limit') ||
    message.includes('timeout') ||
    message.includes('503') ||
    message.includes('529')
  )
}

export async function runJudge(
  url: string,
  metadata: PageMetadata,
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null,
  findings: DeterministicFinding[],
  desktopBase64: string | null,
  mobileBase64: string | null
): Promise<JudgeOutput> {
  const context = {
    url,
    pageText: metadata.pageText,
    metadata: {
      title: metadata.title,
      description: metadata.description,
      h1s: metadata.h1s,
      ctaTexts: metadata.ctaTexts,
      hasStructuredData: metadata.hasStructuredData,
    },
    scores: {
      desktopPerf: desktop?.score ?? null,
      mobilePerf: mobile?.score ?? null,
      desktopLcp: desktop?.lcp ?? null,
      mobileLcp: mobile?.lcp ?? null,
      cls: desktop?.cls ?? null,
    },
    topOpportunities: [
      ...(desktop?.opportunities ?? []),
      ...(mobile?.opportunities ?? []),
    ].slice(0, 5),
    deterministicFindings: findings.map((f) => ({
      checkId: f.checkId,
      problem: f.problem,
      evidence: f.evidence,
      area: f.area,
      severity: f.severity,
    })),
  }

  const imageContent: Anthropic.ImageBlockParam[] = []
  if (desktopBase64) {
    imageContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/webp', data: desktopBase64 },
    })
  }
  if (mobileBase64) {
    imageContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/webp', data: mobileBase64 },
    })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)

  try {
    const response = await anthropic.messages.create(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        tools: [QUALITY_REPORT_TOOL],
        tool_choice: { type: 'tool', name: 'quality_report' },
        messages: [
          {
            role: 'user',
            content: [...imageContent, { type: 'text', text: buildJudgePrompt(context) }],
          },
        ],
      },
      { signal: controller.signal }
    )

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool_use in judge response')
    }

    const parsed = judgeOutputSchema.safeParse(toolUse.input)
    if (!parsed.success) {
      throw new Error(`Invalid judge output: ${parsed.error.message}`)
    }

    return parsed.data
  } finally {
    clearTimeout(timeout)
  }
}
