import { SITE_URL } from '@/lib/marketing/copy/brand'
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
}

export function getMcpEndpoint(baseUrl: string = SITE_URL): string {
  return `${baseUrl.replace(/\/$/, '')}/api/mcp`
}

export function buildEditorMcpConfiguration(
  editorKey: EditorIntegrationKey,
  baseUrl: string = SITE_URL
): EditorMcpConfiguration {
  const editor = getEditorIntegration(editorKey)
  const url = getMcpEndpoint(baseUrl)
  const authorization = `Bearer ${FIXFLAGS_API_KEY_PLACEHOLDER}`

  if (editorKey === 'cursor' || editorKey === 'claudeCode') {
    return {
      editor: editorKey,
      label: editorKey === 'cursor' ? 'mcp.json' : '.mcp.json',
      location: editor.setupLocation,
      language: 'json',
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
    value: `Name: FixFlags
URL: ${url}
Transport: Streamable HTTP
Authentication: Bearer token
Authorization: ${authorization}
`,
  }
}

export function buildMcpTestCurl(baseUrl: string = SITE_URL): string {
  const url = getMcpEndpoint(baseUrl)
  return `curl -s -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $${FIXFLAGS_API_KEY_ENV}" \\
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"fixflags-curl","version":"1.0.0"}},"id":1}'`
}

export function buildEditorSetupPath(editorKey: EditorIntegrationKey): string {
  const returnTo = `/docs/integrations#${getEditorIntegration(editorKey).docsAnchor}`
  return `/dashboard/mcp-setup?builder=${editorKey}&returnTo=${encodeURIComponent(returnTo)}`
}

