import { DocsMarkdown } from '@/components/docs/DocsMarkdown'
import { DocsPageFrame } from '@/components/docs/DocsPageFrame'
import { buildDocsMetadata, getDocsPage } from '@/lib/docs/catalog'
import { readDocsMarkdown } from '@/lib/docs/content'

const page = getDocsPage('integrations')
export const metadata = buildDocsMetadata(page)

export default async function IntegrationsDocsPage() {
  return <DocsPageFrame page={page}><DocsMarkdown>{await readDocsMarkdown(page)}</DocsMarkdown></DocsPageFrame>
}
