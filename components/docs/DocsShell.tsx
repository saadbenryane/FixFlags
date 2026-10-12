import type { KnowledgeSearchEntry } from '@/lib/knowledge/search'
import { DocsMobileNavigation } from '@/components/docs/DocsMobileNavigation'
import { DocsNavigation } from '@/components/docs/DocsNavigation'
import { KnowledgeSearch } from '@/components/help/KnowledgeSearch'
import s from './DocsExperience.module.css'

export function DocsShell({
  entries,
  children,
}: {
  entries: readonly KnowledgeSearchEntry[]
  children: React.ReactNode
}) {
  return (
    <div className={s.shell}>
      <DocsMobileNavigation entries={entries} />
      <div className={s.layout}>
        <aside className={s.sidebar}>
          <div className={s.sidebarContent}>
            <KnowledgeSearch entries={entries} placeholder="Search help and docs" />
            <DocsNavigation />
          </div>
        </aside>
        <div className={s.main}>{children}</div>
      </div>
    </div>
  )
}
