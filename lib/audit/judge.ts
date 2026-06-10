import Anthropic from '@anthropic-ai/sdk'
import { QUALITY_REPORT_TOOL, buildJudgePrompt } from '../prompts/system-prompt'
import { PageMetadata } from './metadata'
import { PageSpeedResult } from './pagespeed'
import { DeterministicFinding } from './checks'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface JudgeOutput {
  pageJob: string
  pageType: string
  verdict: string
  score: number
  areas: Array<{
    name: string
    score?: number
    grade: string
    status: string
    summary: string
    areaPrompt: string
    cursorPrompt?: string
    claudePrompt?: string
    lovablePrompt?: string
    boltPrompt?: string
  }>
  newFindings: Array<{
    area: string
    severity: string
    problem: string
    evidence: string
    fix: string
    confidence: number
    agentPrompt?: string
    cursorPrompt?: string
    claudePrompt?: string
    lovablePrompt?: string
    boltPrompt?: string
    verificationRule?: string
  }>
  enrichments: Array<{
    checkId: string
    whyItMatters: string
    agentPrompt?: string
    cursorPrompt?: string
    claudePrompt?: string
    lovablePrompt?: string
    boltPrompt?: string
    verificationRule?: string
  }>
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
            content: [
              ...imageContent,
              { type: 'text', text: buildJudgePrompt(context) },
            ],
          },
        ],
      },
      { signal: controller.signal }
    )

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool_use in judge response')
    }

    return toolUse.input as JudgeOutput
  } finally {
    clearTimeout(timeout)
  }
}
