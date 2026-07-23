import { SITE_URL } from '@/lib/marketing/copy'
import { getMcpEndpoint } from '@/lib/mcp/docs-content'

type McpToolArguments = Record<string, string>

function buildToolCallBody(
  name: string,
  args: McpToolArguments,
  id: number
): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name,
      arguments: args,
    },
    id,
  })
}

export function buildReportMcpCommand(auditId: string, baseUrl = SITE_URL): string {
  const endpoint = getMcpEndpoint(baseUrl)
  const reportCall = buildToolCallBody('ff_get_report', { reportId: auditId }, 1)

  return `I ran a FixFlags check. Use the FixFlags MCP server to fetch the report, identify the highest-priority flags, then open the specific flag details before editing.

Endpoint: ${endpoint}
Report ID: ${auditId}

Run these MCP tool calls:
1. \`tools/call\` → \`ff_get_report\` with arguments: \`{"reportId":"${auditId}"}\`
2. \`tools/call\` → \`ff_get_rubric\` for \`MESSAGE\`, \`EXPERIENCE\`, and \`REACH\`
3. \`tools/call\` → \`ff_get_all_fixes\` for the complete ranked Fix list

Example curl for the first call:
\`\`\`bash
curl -s -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $FF_API_KEY" \\
  -d '${reportCall}'
\`\`\``
}
