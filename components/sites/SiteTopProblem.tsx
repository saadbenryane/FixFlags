'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Route } from 'next'
import { ArrowRight, Flag } from 'lucide-react'
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

/** The owner's answer wins over detection; detection covers owners who have not answered. */
export function handoffTool(technologies: readonly { name: string }[], reported?: string | null) {
  return AI_BUILDER_TOOLS.find(tool => tool.slug === reported) ?? detectedBuilder(technologies)
}

function pathOf(url: string | null) {
  if (!url) return null
  try { return new URL(url).pathname || '/' } catch { return url.startsWith('/') ? url : null }
}

export function SiteTopProblem({ siteId, flag, copyAvailability, copyReady, technologies, reportedBuilder, onOpen }: {
  siteId: string
  flag: SiteFlagSeed
  copyAvailability: SiteActionAvailability
  copyReady: boolean
  technologies: readonly { name: string }[]
  reportedBuilder?: string | null
  onOpen: (id: string, trigger: HTMLElement) => void
}) {
  const path = pathOf(flag.pageUrl)
  const builder = handoffTool(technologies, reportedBuilder)
  return <section aria-labelledby="top-problem-title" className="rounded-card bg-brand-muted/60 p-5">
    <p className="flex items-center gap-2 text-xs font-semibold text-foreground"><Flag size={14} className="text-brand" aria-hidden="true" />{C.label}</p>
    <h2 id="top-problem-title" className="mt-2 text-xl font-semibold tracking-tight text-foreground">{flag.problem}</h2>
    {path ? <p className="mt-1 text-sm text-muted-foreground">{C.page(path)}</p> : null}
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {/* Handing the fix to the AI is the one primary action; reading the Flag is secondary. */}
      {copyReady ? <SitePromptCopyButton siteId={siteId} flagId={flag.id} flagTitle={flag.problem} availability={copyAvailability} /> : null}
      <Button type="button" variant={copyReady ? 'outline' : 'default'} className="min-h-11" onClick={event => onOpen(flag.id, event.currentTarget)}>
        {C.view}<ArrowRight size={15} aria-hidden="true" />
      </Button>
    </div>
    {builder ? <p className="mt-3 text-sm text-muted-foreground">{builder.where}{' '}
      <Link href={`/ai-builders/${builder.slug}` as Route} className="font-medium text-foreground underline-offset-4 hover:underline">{C.builderGuide(builder.name)}</Link></p> : null}
  </section>
}
