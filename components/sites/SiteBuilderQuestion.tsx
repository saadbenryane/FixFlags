'use client'

import { useEffect, useState } from 'react'
import { InteractiveButton } from '@/components/ui/interactive-controls'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'

const C = SITE_DASHBOARD_COPY.builderQuestion

/** One question for owners: where the Site was built. Hidden once answered. */
export function SiteBuilderQuestion({ siteId, onAnswer }: { siteId: string; onAnswer: (tool: string) => void }) {
  const [state, setState] = useState<'loading' | 'ask' | 'saving' | 'saved' | 'failed' | 'hidden'>('loading')
  useEffect(() => {
    let active = true
    fetch(`/api/sites/${encodeURIComponent(siteId)}/builder`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<{ tool: string | null }> : null)
      .then(body => {
        if (!active) return
        if (body?.tool) { onAnswer(body.tool); setState('hidden') } else setState(body ? 'ask' : 'hidden')
      })
      .catch(() => { if (active) setState('hidden') })
    return () => { active = false }
  }, [siteId, onAnswer])

  async function answer(tool: string) {
    setState('saving')
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/builder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool }),
      })
      if (!response.ok) throw new Error('save failed')
      const body = await response.json() as { tool: string }
      onAnswer(body.tool)
      setState('saved')
    } catch { setState('failed') }
  }

  if (state === 'loading' || state === 'hidden') return null
  if (state === 'saved') return <p role="status" className="rounded-card bg-muted/30 p-4 text-sm text-muted-foreground">{C.saved}</p>
  return <section aria-labelledby="builder-question-title" className="rounded-card bg-muted/30 px-5 py-4">
    <p className="text-sm text-muted-foreground"><span id="builder-question-title" role="heading" aria-level={2} className="font-semibold text-foreground">{C.title}</span>{' '}{C.body}</p>
    <ul className="mt-3 flex flex-wrap gap-2">{C.options.map(option => <li key={option.id}>
      <InteractiveButton type="button" disabled={state === 'saving'} onClick={() => void answer(option.id)}
        className="inline-flex min-h-11 items-center rounded-pill bg-background/70 px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-background disabled:opacity-60">{option.label}</InteractiveButton>
    </li>)}</ul>
    {state === 'failed' ? <p role="alert" className="mt-2 text-sm text-destructive">{C.failed}</p> : null}
  </section>
}
