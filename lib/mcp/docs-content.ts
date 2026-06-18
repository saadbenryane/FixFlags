import { SITE_URL, BRAND } from '@/lib/marketing/copy'

export const MCP_TOOL_DEFINITIONS = [
  { name: 'ff_check_url', desc: 'Start a FixFlags check on any URL. Returns reportId.' },
  { name: 'ff_get_check_status', desc: 'Check if a report is complete.' },
  { name: 'ff_get_report', desc: 'Get rubric summaries (scores, grades, status) and shareStatus. Use ff_get_rubric or ff_get_flag for fix prompts.' },
  {
    name: 'ff_get_rubric',
    desc: 'Get detailed flags + fix prompt for one rubric (Message, Experience, Reach)',
  },
  { name: 'ff_get_flag', desc: 'Get the fix prompt for a specific flag.' },
  { name: 'ff_recheck', desc: 'Run a new check on the same URL to verify fixes.' },
  {
    name: 'ff_compare',
    desc: 'Compare two reports: see what improved, stayed the same, or regressed.',
  },
  {
    name: 'generate-fix-prompt',
    desc: 'Generate a custom fix prompt from any problem description. Useful for Bolt/Lovable.',
  },
] as const

export const MCP_LOCAL_BASE_URL = 'http://localhost:3000'

export function getMcpEndpoint(baseUrl: string = SITE_URL): string {
  return `${baseUrl.replace(/\/$/, '')}/api/mcp`
}

export function buildMcpConfigExample(
  editor: 'claudeCode' | 'cursor' | 'windsurf',
  baseUrl: string = SITE_URL
): string {
  const url = getMcpEndpoint(baseUrl)

  if (editor === 'windsurf') {
    return `# ~/.codeium/windsurf/mcp_config.json
{
  "mcpServers": {
    "${BRAND.mcpServerKey}": {
      "serverUrl": "${url}",
      "headers": {
        "x-api-key": "ff_live_your_key_here"
      }
    }
  }
}`
  }

  const file = editor === 'claudeCode' ? '# ~/.claude/mcp.json' : '# .cursor/mcp.json'

  return `${file}
{
  "mcpServers": {
    "${BRAND.mcpServerKey}": {
      "url": "${url}",
      "headers": {
        "x-api-key": "ff_live_your_key_here"
      }
    }
  }
}`
}

export function buildMcpTestCurl(baseUrl: string = SITE_URL): string {
  const url = getMcpEndpoint(baseUrl)
  return `curl -s -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $FF_API_KEY" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`
}
