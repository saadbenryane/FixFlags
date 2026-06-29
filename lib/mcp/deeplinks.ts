import { BRAND } from '@/lib/marketing/copy'
import { getMcpEndpoint } from './docs-content'

export interface McpInstallConfig {
  baseUrl: string
  apiKey: string
}

function buildServerConfig({ baseUrl, apiKey }: McpInstallConfig) {
  return {
    url: getMcpEndpoint(baseUrl),
    headers: { 'x-api-key': apiKey },
  }
}

/** cursor://anysphere.cursor-deeplink/mcp/install - Cursor's one-click "Add MCP server" deep link. */
export function buildCursorInstallLink(config: McpInstallConfig): string {
  const serverConfig = buildServerConfig(config)
  const encoded = Buffer.from(JSON.stringify(serverConfig)).toString('base64')
  const params = new URLSearchParams({ name: BRAND.mcpServerKey, config: encoded })
  return `cursor://anysphere.cursor-deeplink/mcp/install?${params.toString()}`
}

/** vscode:mcp/install - VS Code / Copilot Chat agent-mode one-click MCP install. */
export function buildVscodeInstallLink(config: McpInstallConfig): string {
  const serverConfig = { name: BRAND.mcpServerKey, ...buildServerConfig(config) }
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(serverConfig))}`
}
