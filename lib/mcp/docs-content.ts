import { SITE_URL, BRAND } from '@/lib/marketing/copy'
import type { ApiKeyClient } from '@/lib/mcp/builders'
export { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/tool-manifest'

export const MCP_LOCAL_BASE_URL = 'http://localhost:3000'

export function getMcpEndpoint(baseUrl: string = SITE_URL): string {
  return `${baseUrl.replace(/\/$/, '')}/api/mcp`
}

export function buildMcpConfigExample(
  editor: Extract<ApiKeyClient, 'claudeCode' | 'cursor' | 'windsurf' | 'lovable' | 'bolt'>,
  baseUrl: string = SITE_URL
): string {
  const url = getMcpEndpoint(baseUrl)

  if (editor === 'lovable' || editor === 'bolt') {
    const connectorArea =
      editor === 'lovable'
        ? 'Lovable → Settings → Connectors → Add custom connector'
        : 'Bolt → Settings → MCP → Add server'
    return `${connectorArea}

Name: ${BRAND.name}
URL: ${url}
Transport: HTTP
Authentication: API key
API key: ff_live_your_key_here`
  }

  if (editor === 'windsurf') {
    return `# ~/.codeium/windsurf/mcp_config.json
{
  "mcpServers": {
    "${BRAND.mcpServerKey}": {
      "serverUrl": "${url}",
      "headers": {
        "Authorization": "Bearer ff_live_your_key_here"
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
        "Authorization": "Bearer ff_live_your_key_here"
      }
    }
  }
}`
}

export function buildMcpTestCurl(baseUrl: string = SITE_URL): string {
  const url = getMcpEndpoint(baseUrl)
  return `curl -s -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $FIXFLAGS_API_KEY" \\
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"fixflags-curl","version":"1.0.0"}},"id":1}'`
}
