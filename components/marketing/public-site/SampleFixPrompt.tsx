'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { trackEvent } from '@/lib/analytics/events'
import { readOrCreateAnalyticsJourneyId } from '@/lib/analytics/journey-id'

const C = PUBLIC_SITE_COPY.samplePage

export function SampleFixPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false)
  const [manual, setManual] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    trackEvent('viewed_sample', { placement: 'samples' })
  }, [])
  useEffect(() => {
    if (manual) { promptRef.current?.focus(); promptRef.current?.select() }
  }, [manual])
  return <div className="space-y-4">
    <p className="whitespace-pre-wrap text-sm leading-7">{prompt}</p>
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal py-2" onClick={async () => {
        try {
          await navigator.clipboard.writeText(prompt)
          setCopied(true); setManual(false)
          trackEvent('marketing_interaction', { page: '/samples', action: 'copy', target: 'fix-prompt', journey_id: readOrCreateAnalyticsJourneyId() ?? undefined })
        } catch { setManual(true); setCopied(false) }
      }}>{C.copy}</Button>
      <Link className="inline-flex min-h-11 max-w-full items-center text-sm font-medium text-link underline underline-offset-4" href="/docs/fix-with-ai">{C.guidance}</Link>
    </div>
    {copied ? <p role="status" className="text-sm">{C.copied}</p> : null}
    {manual ? <div className="space-y-2"><p role="status" className="text-sm">{C.copyFallback}</p><Textarea ref={promptRef} readOnly aria-label={C.prompt} value={prompt} rows={6} onFocus={event => event.currentTarget.select()} /></div> : null}
  </div>
}
