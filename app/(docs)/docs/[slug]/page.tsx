import { notFound } from 'next/navigation'
import { DocsMarkdown } from '@/components/docs/DocsMarkdown'
import { DocsPageFrame } from '@/components/docs/DocsPageFrame'
import {
  buildDocsMetadata,
  DOCS_PAGES,
  type DocsPageDefinition,
} from '@/lib/docs/catalog'
import { readDocsMarkdown } from '@/lib/docs/content'

const MARKDOWN_PAGES = DOCS_PAGES.filter(
  (page): page is DocsPageDefinition & { source: string } =>
    Boolean(page.source && page.path !== '/docs')
)

function pageFromSlug(slug: string) {
  return MARKDOWN_PAGES.find((page) => page.path === `/docs/${slug}`)
}

export function generateStaticParams() {
  return MARKDOWN_PAGES.map((page) => ({ slug: page.path.replace('/docs/', '') }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = pageFromSlug(slug)
  return page ? buildDocsMetadata(page) : {}
}

export default async function NarrativeDocsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = pageFromSlug(slug)
  if (!page) notFound()
  const markdown = await readDocsMarkdown(page)
  return (
    <DocsPageFrame page={page}>
      <DocsMarkdown>{markdown}</DocsMarkdown>
    </DocsPageFrame>
  )
}
