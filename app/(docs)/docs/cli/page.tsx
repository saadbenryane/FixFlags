import { CliInstallCard } from '@/components/cli/CliInstallCard'
import { DocsMarkdown } from '@/components/docs/DocsMarkdown'
import { DocsPageFrame } from '@/components/docs/DocsPageFrame'
import { buildDocsMetadata, getDocsPage } from '@/lib/docs/catalog'
import { readDocsMarkdown } from '@/lib/docs/content'

const page = getDocsPage('cli')
export const metadata = buildDocsMetadata(page)

export default async function CliDocsPage() {
  const markdown = await readDocsMarkdown(page)
  return (
    <DocsPageFrame page={page}>
      <CliInstallCard />
      <DocsMarkdown>{markdown}</DocsMarkdown>
    </DocsPageFrame>
  )
}
