import 'server-only'

import { DOCS_PAGES, getDocsPageByPath, type DocsPageDefinition } from '@/lib/docs/catalog'
import { readDocsMarkdown } from '@/lib/docs/content'
import { SITE_URL } from '@/lib/marketing/copy/brand'

const baseUrl = SITE_URL.replace(/\/$/, '')

async function renderDocument(page: DocsPageDefinition): Promise<string> {
  const body = await readDocsMarkdown(page)
  // Keep root-relative documentation links usable when the text is read on its own.
  const markdown = body.replace(/(\]\()\/(?!\/)([^\s)]*)(\))/g, `$1${baseUrl}/$2$3`)
  return `# ${page.title}\n\n${page.description}\n\nCanonical page: ${baseUrl}${page.path}\n\n${markdown.trim()}\n`
}

function textResponse(body: string, status: number, canonicalPath?: string, type = 'text/plain') {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': `${type}; charset=utf-8`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, follow',
      ...(canonicalPath ? { Link: `<${baseUrl}${canonicalPath}>; rel="canonical"` } : {}),
    },
  })
}

/** Only the published catalog can authorize a file read. Never read a URL as a path. */
export async function docsMarkdownResponse(path: string): Promise<Response> {
  const page = getDocsPageByPath(path)
  if (!page?.source) return textResponse('Documentation not found.\n', 404)
  try {
    return textResponse(await renderDocument(page), 200, page.path, 'text/markdown')
  } catch {
    return textResponse('Documentation is temporarily unavailable.\n', 503)
  }
}

export async function fullDocsResponse(): Promise<Response> {
  try {
    const documents = await Promise.all(DOCS_PAGES.filter(page => page.source).map(renderDocument))
    return textResponse(documents.join('\n'), 200, '/docs')
  } catch {
    return textResponse('Documentation is temporarily unavailable.\n', 503)
  }
}
