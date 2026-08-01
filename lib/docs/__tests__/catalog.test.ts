import { describe, expect, it } from 'vitest'
import { DOCS_PAGES, getDocsPage, slugifyDocsHeading } from '@/lib/docs/catalog'
import { EDITOR_INTEGRATIONS } from '@/lib/integrations/editor-catalog'
import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/tool-manifest'

describe('documentation catalog', () => {
  it('defines every public docs route once', () => {
    expect(DOCS_PAGES.map((page) => page.path)).toEqual([
      '/docs',
      '/docs/getting-started',
      '/docs/reports',
      '/docs/integrations',
      '/docs/cli',
      '/docs/mcp',
      '/docs/mcp/tools',
      '/docs/troubleshooting',
    ])
    expect(new Set(DOCS_PAGES.map((page) => page.path)).size).toBe(DOCS_PAGES.length)
  })

  it('renders one integration heading for every editor anchor', () => {
    const headings = getDocsPage('integrations').headings.map((heading) => heading.id)
    for (const editor of EDITOR_INTEGRATIONS) {
      expect(headings).toContain(editor.docsAnchor)
    }
  })

  it('creates stable heading and tool reference anchors', () => {
    expect(slugifyDocsHeading('Update review & Compare')).toBe('update-review-and-compare')
    expect(new Set(MCP_TOOL_DEFINITIONS.map((tool) => tool.name)).size).toBe(
      MCP_TOOL_DEFINITIONS.length
    )
  })
})
