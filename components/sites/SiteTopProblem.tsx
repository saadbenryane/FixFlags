'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Flag } from 'lucide-react'
import { InteractiveButton } from '@/components/ui/interactive-controls'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'
import { compareFlagPriority } from '@/lib/sites/presentation'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import type { SiteActionAvailability } from '@/lib/sites/viewer-actions'
import { AI_BUILDER_TOOLS } from '@/lib/marketing/copy/ai-builders'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'

const C = SITE_DASHBOARD_COPY.topProblem

/** The single most important open Flag, or null when nothing is fix-first. */
export function topProblem(flags: readonly SiteFlagSeed[]): SiteFlagSeed | null {
  return flags.filter(flag => flag.priorityBand === 'fix_first' && flag.status !== 'IGNORED').toSorted(compareFlagPriority)[0] ?? null
}

/** An AI builder FixFlags detected on the Site, for a tool-specific handoff hint. */
export function detectedBuilder(technologies: readonly { name: string }[]) {
  const names = new Set(technologies.map(item => item.name.toLowerCase()))
  return AI_BUILDER_TOOLS.find(tool => tool.kind === 'builder' && names.has(tool.name.toLowerCase())) ?? null
}

function pathOf(url: string | null) {
  if (!url) return null
  try { return new URL(url).pathname || '/' } catch { return url.startsWith('/') ? url : null }
}

export function SiteTopProblem({ siteId, flag, copyAvailability, copyReady, technologies, onOpen }: {
  siteId: string
  flag: SiteFlagSeed
  copyAvailability: SiteActionAvailability
  copyReady: boolean
  technologies: readonly { name: string }[]
  onOpen: (id: string, trigger: HTMLElement) => void
}) {
  const path = pathOf(flag.pageUrl)
  const builder = detectedBuilder(technologies)
  return <section aria-labelledby="top-problem-title" className="rounded-card bg-brand-muted/60 p-5">
    <p className="flex items-center gap-2 text-xs font-semibold text-foreground"><Flag size={14} className="text-brand" aria-hidden="true" />{C.label}</p>
    <h2 id="top-problem-title" className="mt-2 text-xl font-semibold tracking-tight text-foreground">{flag.problem}</h2>
    {path ? <p className="mt-1 text-sm text-muted-foreground">{C.page(path)}</p> : null}
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <InteractiveButton type="button" className="inline-flex min-h-11 items-center gap-2 rounded-control bg-foreground px-4 text-sm font-semibold text-background hover:bg-foreground/90" onClick={event => onOpen(flag.id, event.currentTarget)}>
        {C.view}<ArrowRight size={15} aria-hidden="true" />
      </InteractiveButton>
      {copyReady ? <SitePromptCopyButton siteId={siteId} flagId={flag.id} flagTitle={flag.problem} availability={copyAvailability} /> : null}
    </div>
    {builder ? <p className="mt-3 text-sm text-muted-foreground">{C.builder(builder.name)}{' '}
      <Link href={`/ai-builders/${builder.slug}` as Route} className="font-medium text-foreground underline-offset-4 hover:underline">{C.builderGuide(builder.name)}</Link></p> : null}
  </section>
}
