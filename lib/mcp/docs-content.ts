import { SITE_URL } from '@/lib/marketing/copy'
import type { EditorIntegrationKey } from '@/lib/integrations/editor-catalog'
import {
  buildEditorMcpConfiguration,
  buildMcpTestCurl,
  getMcpEndpoint,
} from '@/lib/integrations/editor-config'
export { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/tool-manifest'
export { buildMcpTestCurl, getMcpEndpoint }

export const MCP_LOCAL_BASE_URL = 'http://localhost:3000'

export function buildMcpConfigExample(
  editor: EditorIntegrationKey,
  baseUrl: string = SITE_URL
): string {
  return buildEditorMcpConfiguration(editor, baseUrl).value
}
