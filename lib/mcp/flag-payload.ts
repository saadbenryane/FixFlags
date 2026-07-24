import { buildExpertFixPrompt } from '@/lib/audit/flag-copy'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import {
  resolveToolPrompt,
  type PromptToolKey,
} from '@/lib/mcp/builders'

export type McpPromptTool = PromptToolKey

export type McpFlagPayloadInput = RankableFlag & {
  evidence: string
  fix: string
}

export interface McpFlagPayload {
  id: string
  rubric: string
  severity: string
  problem: string
  evidence: string
  whyItMatters: string | undefined
  fix: string
  prompt: string | null
  promptError?: string
  verificationRule: string | null | undefined
}

export function buildMcpFlagPayload(
  flag: McpFlagPayloadInput,
  tool: McpPromptTool = 'universal'
): McpFlagPayload {
  const expertPrompt = buildExpertFixPrompt(flag)
  const promptMap: Record<McpPromptTool, string | null | undefined> = {
    universal: expertPrompt,
    cursor: flag.cursorPrompt,
    claude: flag.claudePrompt,
    windsurf: flag.windsurfPrompt,
    lovable: flag.lovablePrompt,
    bolt: flag.boltPrompt,
  }

  const prompt = resolveToolPrompt(promptMap, tool, expertPrompt)
  return {
    id: flag.id,
    rubric: flag.rubric,
    severity: flag.severity,
    problem: flag.problem,
    evidence: flag.evidence,
    whyItMatters: flag.whyItMatters,
    fix: flag.fix,
    prompt,
    ...(prompt
      ? {}
      : { promptError: `No validated ${tool} prompt is available for this Flag.` }),
    verificationRule: flag.verificationRule,
  }
}
