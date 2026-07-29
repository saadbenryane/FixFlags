import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { DOCS_PAGES, type DocsPageDefinition } from '@/lib/docs/catalog'
import { EDITOR_INTEGRATIONS } from '@/lib/integrations/editor-catalog'
import { MCP_TOOL_DEFINITIONS } from '@/lib/mcp/tool-manifest'

export interface DocsSearchEntry {
  title: string
  description: string
  href: string
  keywords: string
}

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'docs')

export async function readDocsMarkdown(page: DocsPageDefinition) {
  if (!page.source) return ''
  return readFile(path.join(CONTENT_ROOT, page.source), 'utf8')
}

function searchableText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`[\]()|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function buildDocsSearchIndex(): Promise<DocsSearchEntry[]> {
  const pages = await Promise.all(
    DOCS_PAGES.map(async (page) => {
      const markdown = await readDocsMarkdown(page)
      return {
        title: page.title,
        description: page.description,
        href: page.path,
        keywords: [
          page.group,
          page.headings.map((heading) => heading.title).join(' '),
          searchableText(markdown),
        ].join(' '),
      }
    })
  )

  const editors = EDITOR_INTEGRATIONS.map((editor) => ({
    title: `${editor.label} integration`,
    description: `Connect FixFlags in ${editor.label}.`,
    href: `/docs/integrations#${editor.docsAnchor}`,
    keywords: `${editor.label} ${editor.setupMode} ${editor.setupLocation} MCP editor connection`,
  }))

  const tools = MCP_TOOL_DEFINITIONS.map((tool) => ({
    title: tool.name,
    description: tool.desc,
    href: `/docs/mcp/tools#${tool.name}`,
    keywords: `MCP tool ${tool.name} ${tool.desc}`,
  }))

  return [...pages, ...editors, ...tools]
}
