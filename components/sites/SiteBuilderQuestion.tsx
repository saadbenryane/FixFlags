'use client'

import { useEffect, useState } from 'react'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'

const C = SITE_DASHBOARD_COPY.builderQuestion

/** One question for owners, asked inside the fix card: where the Site was built. Hidden once answered. */
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
  if (state === 'saved') return <p role="status" className="text-sm text-muted-foreground">{C.saved}</p>
  // One quiet line inside the fix card: the answer only tunes where fix instructions point.
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
    <label htmlFor={`builder-${siteId}`} className="text-muted-foreground">{C.title}</label>
    <select id={`builder-${siteId}`} defaultValue="" disabled={state === 'saving'} onChange={event => { if (event.currentTarget.value) void answer(event.currentTarget.value) }}
      className="min-h-11 rounded-control bg-background/80 px-3 pr-8 text-sm font-medium text-foreground shadow-[0_1px_2px_hsl(30_10%_20%/.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60">
      <option value="" disabled>{C.placeholder}</option>
      {C.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    {state === 'failed' ? <p role="alert" className="w-full text-sm text-destructive">{C.failed}</p> : null}
  </div>
}
