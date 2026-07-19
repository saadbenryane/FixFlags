import { buildExpertFixPrompt } from '@/lib/audit/flag-copy'
import type { RankableFlag } from '@/lib/audit/priority-flags'

export type McpPromptTool = 'generic' | 'cursor' | 'claude' | 'windsurf' | 'lovable' | 'bolt'

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
  prompt: string
  verificationRule: string | null | undefined
}

export function buildMcpFlagPayload(
  flag: McpFlagPayloadInput,
  tool: McpPromptTool = 'generic'
): McpFlagPayload {
  const expertPrompt = buildExpertFixPrompt(flag)
  const promptMap: Record<McpPromptTool, string | null | undefined> = {
    generic: expertPrompt,
    cursor: flag.cursorPrompt,
    claude: flag.claudePrompt,
    windsurf: flag.windsurfPrompt,
    lovable: flag.lovablePrompt,
    bolt: flag.boltPrompt,
  }

  return {
    id: flag.id,
    rubric: flag.rubric,
    severity: flag.severity,
    problem: flag.problem,
    evidence: flag.evidence,
    whyItMatters: flag.whyItMatters,
    fix: flag.fix,
    prompt: promptMap[tool]?.trim() || expertPrompt,
    verificationRule: flag.verificationRule,
  }
}
