'use client'

import { cn } from '@/lib/utils'

export interface WorkspaceMobileTab {
  id: string
  label: string
  selected: boolean
  onSelect: () => void
}

/**
 * One tab bar for small screens. The live editor and marketing emulations
 * share this so stacked panes cannot bury Product reality.
 */
export function WorkspaceMobileTabs({
  tabs,
  label,
}: {
  tabs: WorkspaceMobileTab[]
  label: string
}) {
  return (
    <div
      className="flex shrink-0 gap-0 border-b border-border/40 lg:hidden"
      role="tablist"
      aria-label={label}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.selected}
          className={cn(
            'min-h-11 flex-1 px-3 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
            tab.selected ? 'border-b-2 border-brand text-foreground' : 'text-muted-foreground'
          )}
          onClick={tab.onSelect}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
