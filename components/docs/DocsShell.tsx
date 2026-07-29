import type { DocsSearchEntry } from '@/lib/docs/content'
import { DocsMobileNavigation } from '@/components/docs/DocsMobileNavigation'
import { DocsNavigation } from '@/components/docs/DocsNavigation'
import { DocsSearch } from '@/components/docs/DocsSearch'

export function DocsShell({
  entries,
  children,
}: {
  entries: readonly DocsSearchEntry[]
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-border/40 bg-background">
      <DocsMobileNavigation entries={entries} />
      <div className="mx-auto grid w-full max-w-[96rem] lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-border/50 px-5 py-8 lg:block">
          <div className="sticky top-[calc(var(--header-height-marketing)+2rem)] space-y-8">
            <DocsSearch entries={entries} compact />
            <DocsNavigation />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
