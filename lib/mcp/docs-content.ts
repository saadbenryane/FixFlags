import { SITE_URL } from '@/lib/marketing/copy'

export const MCP_TOOL_DEFINITIONS = [
  { name: 'qos_audit_url', desc: 'Start a quality audit on any URL. Returns auditId.' },
  { name: 'qos_get_audit_status', desc: 'Check if an audit is complete.' },
  { name: 'qos_get_report', desc: 'Get the full report with all 7 area grades and scores.' },
  {
    name: 'qos_get_area',
    desc: 'Get detailed findings + fix prompt for one area (Performance, SEO, Mobile, etc.)',
  },
  { name: 'qos_get_finding', desc: 'Get the fix prompt for a specific finding.' },
  { name: 'qos_recheck', desc: 'Run a new audit on the same URL to verify fixes.' },
  {
    name: 'qos_compare',
    desc: 'Compare two audits: see what improved, stayed the same, or regressed.',
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
    "qualityos": {
      "serverUrl": "${url}",
      "headers": {
        "x-api-key": "qos_live_your_key_here"
      }
    }
  }
}`
  }

  const file = editor === 'claudeCode' ? '# ~/.claude/mcp.json' : '# .cursor/mcp.json'

  return `${file}
{
  "mcpServers": {
    "qualityos": {
      "url": "${url}",
      "headers": {
        "x-api-key": "qos_live_your_key_here"
      }
    }
  }
}`
}

export function buildMcpTestCurl(baseUrl: string = SITE_URL): string {
  const url = getMcpEndpoint(baseUrl)
  return `curl -s -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $QOS_API_KEY" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`
}
