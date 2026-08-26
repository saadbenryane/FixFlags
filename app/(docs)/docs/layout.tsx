import { DocsShell } from '@/components/docs/DocsShell'
import { buildKnowledgeIndex } from '@/lib/knowledge'

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const entries = await buildKnowledgeIndex()
  return <DocsShell entries={entries}>{children}</DocsShell>
}
