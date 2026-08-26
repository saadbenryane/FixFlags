import { KnowledgeSearch } from '@/components/help/KnowledgeSearch'
import { buildKnowledgeIndex } from '@/lib/knowledge'
import { HELP_CENTER } from '@/lib/marketing/copy'

export async function HelpKnowledgeSearch({ compact = false }: { compact?: boolean }) {
  const entries = await buildKnowledgeIndex()

  return (
    <KnowledgeSearch
      entries={entries}
      placeholder={HELP_CENTER.searchPlaceholder}
      className={compact ? 'max-w-xl' : undefined}
    />
  )
}
