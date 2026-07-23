import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { User } from '@prisma/client'
import { assertMcpAccess } from '@/lib/mcp/access'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'

const TOOL_ADVICE: Record<string, string> = {
  cursor: 'In Cursor, reference files with @filename for context.',
  claude: 'Use terminal commands to find and edit files. Ask questions before assuming file contents.',
  windsurf: 'Apply changes one file at a time. Use inline diffs for review before applying.',
  lovable: 'Use Tailwind CSS classes for all styling.',
  bolt: 'Show diffs of every change. Do not rewrite unrelated files.',
  generic: 'Verify: Re-check the page after applying the fix and confirm this issue no longer appears.',
}

const TOOL_SCOPE: Record<string, string> = {
  lovable: 'Keep the change scoped to the affected component or page.',
  generic: 'Keep the change scoped to the affected page, component, or configuration.',
}

export function registerPromptGeneratorTools(server: McpServer, user: User) {
  server.tool(
    MCP_TOOLS.generateFixPrompt.name,
    MCP_TOOLS.generateFixPrompt.desc,
    {
      problem: z.string().min(10).describe('Describe the issue you want fixed'),
      context: z.string().optional().describe('Page URL, technology stack, or any context'),
      tool: z
        .enum(['generic', 'cursor', 'claude', 'windsurf', 'lovable', 'bolt'])
        .optional()
        .describe('Format the prompt for a specific tool'),
    },
    async ({ problem, context, tool = 'generic' }) => {
      await assertMcpAccess(user)

      const lines: string[] = [problem]

      if (context) {
        lines.push('', `Evidence: ${context}`)
      }

      const scope = TOOL_SCOPE[tool] ?? TOOL_SCOPE.generic
      const advice = TOOL_ADVICE[tool] ?? TOOL_ADVICE.generic

      lines.push(
        '',
        'Fix:',
        `1. Fix this issue: ${problem}`,
        `2. ${scope}`,
        '3. Preserve existing working behavior outside this issue.',
        '',
        advice,
      )

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              problem,
              context: context ?? null,
              prompt: lines.join('\n'),
              tool,
            }),
          },
        ],
      }
    }
  )
}
