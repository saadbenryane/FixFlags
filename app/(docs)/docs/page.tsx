import { DocsMarkdown } from '@/components/docs/DocsMarkdown'
import { DocsPageFrame } from '@/components/docs/DocsPageFrame'
import { buildDocsMetadata, getDocsPage } from '@/lib/docs/catalog'
import { readDocsMarkdown } from '@/lib/docs/content'
import { DocsHomePaths } from '@/components/docs/DocsHomePaths'

const page = getDocsPage('home')

export const metadata = buildDocsMetadata(page)

export default async function DocsHomePage() {
  const markdown = await readDocsMarkdown(page)
  return (
    <DocsPageFrame page={page}>
      <DocsHomePaths />
      <DocsMarkdown headings={page.headings}>{markdown}</DocsMarkdown>
    </DocsPageFrame>
  )
}
