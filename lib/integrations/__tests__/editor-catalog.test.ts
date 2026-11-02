import { describe, expect, it } from 'vitest'
import {
  CLI_MANAGED_EDITOR_INTEGRATIONS,
  EDITOR_INTEGRATIONS,
  HOMEPAGE_EDITOR_INTEGRATIONS,
  editorDocsHref,
} from '@/lib/integrations/editor-catalog'
import {
  FIXFLAGS_API_KEY_PLACEHOLDER,
  buildEditorMcpConfiguration,
  buildMcpTestCurl,
} from '@/lib/integrations/editor-config'
import { MCP_PROTOCOL_VERSION, MCP_TOOLS } from '@/lib/mcp/tool-manifest'

describe('editor integration contract', () => {
  it('keeps the deterministic two-row homepage order', () => {
    expect(HOMEPAGE_EDITOR_INTEGRATIONS.map((editor) => editor.label)).toEqual([
      'Lovable',
      'Bolt',
      'Cursor',
      'Replit',
      'Claude Code',
      'Windsurf',
      'Codex',
      'Devin',
    ])
    expect(HOMEPAGE_EDITOR_INTEGRATIONS.map(editorDocsHref)).toEqual([
      '/docs/integrations#lovable',
      '/docs/integrations#bolt',
      '/docs/integrations#cursor',
      '/docs/integrations#replit',
      '/docs/integrations#claude-code',
      '/docs/integrations#windsurf',
      '/docs/integrations#codex',
      '/docs/integrations#devin',
    ])
  })

  it('has unique keys and anchors with a configuration for every editor', () => {
    expect(new Set(EDITOR_INTEGRATIONS.map((editor) => editor.key)).size).toBe(8)
    expect(new Set(EDITOR_INTEGRATIONS.map((editor) => editor.docsAnchor)).size).toBe(8)

    for (const editor of EDITOR_INTEGRATIONS) {
      const configuration = buildEditorMcpConfiguration(editor.key, 'https://fixflags.test')
      expect(configuration.value).toContain('https://fixflags.test/api/mcp')
      if (configuration.language === 'json') {
        expect(() => JSON.parse(configuration.value)).not.toThrow()
      }
      if (editor.setupMode !== 'local-config') {
        expect(configuration.value).toContain(FIXFLAGS_API_KEY_PLACEHOLDER)
      } else {
        expect(configuration.value).toContain('FIXFLAGS_API_KEY')
      }
      expect(configuration.value).not.toMatch(/ff_live_(?!your_key_here)/)
    }
  })
  it('uses each local client’s native environment syntax and preserves explicitly supplied credentials', () => {
    for (const key of ['cursor', 'windsurf', 'claudeCode'] as const) {
      const configuration = buildEditorMcpConfiguration(key)
      expect(configuration.credentialMode).toBe('environment')
      expect(configuration.value).toContain(key === 'claudeCode' ? '${FIXFLAGS_API_KEY}' : '${env:FIXFLAGS_API_KEY}')
      expect(configuration.value).not.toContain(FIXFLAGS_API_KEY_PLACEHOLDER)
      expect(buildEditorMcpConfiguration(key, 'https://fixflags.test', 'test-secret').value).toContain('Bearer test-secret')
    }
  })
  it('builds a read-only diagnostic request from the live protocol and tool registry', () => {
    const example = buildMcpTestCurl('https://fixflags.test')
    const body = JSON.parse(example.match(/-d '(.+)'/)![1])
    expect(example).toContain(`MCP-Protocol-Version: ${MCP_PROTOCOL_VERSION}`)
    expect(example).toContain('Authorization: Bearer $FIXFLAGS_API_KEY')
    expect(body).toMatchObject({ method: 'tools/call', params: { name: MCP_TOOLS.getConnectionInfo.name, arguments: {},
      _meta: { 'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION } } })
    expect(example).not.toContain('initialize')
  })

  it('limits CLI-managed setup to local editors', () => {
    expect(CLI_MANAGED_EDITOR_INTEGRATIONS.map((editor) => editor.key)).toEqual([
      'cursor',
      'claudeCode',
      'windsurf',
      'codex',
    ])
    expect(CLI_MANAGED_EDITOR_INTEGRATIONS.every((editor) => editor.setupMode === 'local-config')).toBe(true)
  })
})
