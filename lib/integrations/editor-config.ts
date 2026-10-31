import type { Route } from 'next'
import { SITE_URL } from '@/lib/marketing/copy/brand'
import { MCP_PROTOCOL_VERSION, MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import {
  getEditorIntegration,
  type EditorIntegrationKey,
} from '@/lib/integrations/editor-catalog'

export const FIXFLAGS_API_KEY_PLACEHOLDER = 'ff_live_your_key_here'
export const FIXFLAGS_API_KEY_ENV = 'FIXFLAGS_API_KEY'

export interface EditorMcpConfiguration {
  editor: EditorIntegrationKey
  label: string
  location: string
  language: 'json' | 'toml' | 'text'
  value: string
  credentialMode: 'environment' | 'bearer-token'
}

export function getMcpEndpoint(baseUrl: string = SITE_URL): string {
  return `${baseUrl.replace(/\/$/, '')}/api/mcp`
}

export function buildEditorMcpConfiguration(
  editorKey: EditorIntegrationKey,
  baseUrl: string = SITE_URL,
  apiKey?: string
): EditorMcpConfiguration {
  const editor = getEditorIntegration(editorKey)
  const url = getMcpEndpoint(baseUrl)
  const environmentToken = editorKey === 'claudeCode' ? '${FIXFLAGS_API_KEY}' : '${env:FIXFLAGS_API_KEY}'
  const authorization = `Bearer ${apiKey ?? environmentToken}`

  if (editorKey === 'cursor' || editorKey === 'claudeCode') {
    return {
      editor: editorKey,
      label: editorKey === 'cursor' ? 'mcp.json' : '.mcp.json',
      location: editor.setupLocation,
      language: 'json',
      credentialMode: apiKey ? 'bearer-token' : 'environment',
      value: `${JSON.stringify(
        {
          mcpServers: {
            fixflags: {
              type: 'http',
              url,
              headers: { Authorization: authorization },
            },
          },
        },
        null,
        2
      )}\n`,
    }
  }

  if (editorKey === 'windsurf') {
    return {
      editor: editorKey,
      label: 'mcp_config.json',
      location: editor.setupLocation,
      language: 'json',
      credentialMode: apiKey ? 'bearer-token' : 'environment',
      value: `${JSON.stringify(
        {
          mcpServers: {
            fixflags: {
              serverUrl: url,
              headers: { Authorization: authorization },
            },
          },
        },
        null,
        2
      )}\n`,
    }
  }

  if (editorKey === 'codex') {
    return {
      editor: editorKey,
      label: 'config.toml',
      location: editor.setupLocation,
      language: 'toml',
      credentialMode: 'environment',
      value: `[mcp_servers.fixflags]
url = "${url}"
bearer_token_env_var = "${FIXFLAGS_API_KEY_ENV}"
`,
    }
  }

  return {
    editor: editorKey,
    label: 'Custom MCP server',
    location: editor.setupLocation,
    language: 'text',
    credentialMode: 'bearer-token',
    value: `Name: FixFlags
URL: ${url}
Transport: Streamable HTTP
Authentication: Bearer token
Authorization: Bearer ${apiKey ?? FIXFLAGS_API_KEY_PLACEHOLDER}
`,
  }
}

export function buildMcpTestCurl(baseUrl: string = SITE_URL): string {
  const url = getMcpEndpoint(baseUrl)
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
    name: MCP_TOOLS.getConnectionInfo.name, arguments: {}, _meta: {
      'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
      'io.modelcontextprotocol/clientInfo': { name: 'fixflags-curl', version: '1.0.0' },
      'io.modelcontextprotocol/clientCapabilities': {},
    },
  } })
  return `curl -s -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json" \\
  -H "MCP-Protocol-Version: ${MCP_PROTOCOL_VERSION}" \\
  -H "Mcp-Method: tools/call" \\
  -H "Mcp-Name: ${MCP_TOOLS.getConnectionInfo.name}" \\
  -H "Authorization: Bearer $${FIXFLAGS_API_KEY_ENV}" \\
  -d '${body}'`
}

export function buildEditorSetupPath(editorKey: EditorIntegrationKey): Route {
  const returnTo = `/docs/integrations#${getEditorIntegration(editorKey).docsAnchor}`
  return `/dashboard/mcp-setup?builder=${editorKey}&returnTo=${encodeURIComponent(returnTo)}` as Route
}
