import { SITE_URL, BRAND } from '@/lib/marketing/copy'
export { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/tool-manifest'

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
