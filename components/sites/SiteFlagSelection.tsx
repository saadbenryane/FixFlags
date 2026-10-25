'use client'

import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import type { SiteActionAvailability } from '@/lib/sites/viewer-actions'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SiteFixBundleButton } from './SiteFixBundleButton'

type Selection = { active: boolean; ids: Set<string>; toggle: (id: string, checked: boolean) => void }
const Context = createContext<Selection | null>(null)
export const useSiteFlagSelection = () => useContext(Context)

/** One explicit repair scope across priority groups, devices, and shared pages. */
export function SiteFlagSelection({ siteId, flags, availability, children, renderSelected }: {
  siteId: string; flags: readonly Pick<SiteFlagSeed, 'id'>[]; availability: SiteActionAvailability; children: ReactNode; renderSelected?: (ids: string[]) => ReactNode;
}) {
  const parent = useSiteFlagSelection()
  const [ids, setIds] = useState<Set<string> | null>(null)
  if (parent) return children
  const selectedIds = [...new Set(flags.filter(flag => ids?.has(flag.id)).map(flag => flag.id))].sort()
  const selection: Selection = { active: ids !== null, ids: ids ?? new Set(), toggle: (id, checked) => setIds(previous => {
    const next = new Set(previous); if (checked) next.add(id); else next.delete(id); return next
  }) }
  return <Context.Provider value={selection}><div className="space-y-4">
    {flags.length > 1 ? <div className="flex flex-wrap items-center gap-2"><Button variant="ghost" size="sm" onClick={() => setIds(ids ? null : new Set())}>{ids ? C.cancelSelection : C.selectFlags}</Button>
      {ids ? <><span role="status" className="text-xs text-muted-foreground">{C.selectedCount(selectedIds.length)}</span>{selectedIds.length ? renderSelected ? renderSelected(selectedIds) : <SiteFixBundleButton key={JSON.stringify(selectedIds)} siteId={siteId} flagIds={selectedIds} availability={availability} /> : null}</> : null}
    </div> : null}
    {children}
  </div></Context.Provider>
}

export function SiteFlagSelectionCheckbox({ flagId, title }: { flagId: string; title: string }) {
  const selection = useSiteFlagSelection()
  const id = useId()
  if (!selection?.active) return null
  return <label htmlFor={id} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center"><Checkbox id={id} aria-label={C.selectFlag(title)} checked={selection.ids.has(flagId)} onCheckedChange={checked => selection.toggle(flagId, checked === true)} /></label>
}
