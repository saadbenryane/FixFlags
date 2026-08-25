import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { DOCS_PAGES, type DocsPageDefinition } from '@/lib/docs/catalog'

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

  return pages
}
