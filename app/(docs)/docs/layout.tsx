import { DocsShell } from '@/components/docs/DocsShell'
import { buildDocsSearchIndex } from '@/lib/docs/content'

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const entries = await buildDocsSearchIndex()
  return <DocsShell entries={entries}>{children}</DocsShell>
}
