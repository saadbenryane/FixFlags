'use client'

import { useState } from 'react'
import { CheckCircle2, Link2Off } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Heading } from '@/components/ui/typography'
import { AuditInput } from '@/components/audit/AuditInput'
import { ToolUrlForm } from '@/components/marketing/tools/ToolUrlForm'
import { SYSTEM_COPY, TOOLS } from '@/lib/marketing/copy-barrel'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { trackToolInteraction, type ToolResultOutcome } from '@/lib/analytics/events'
import type { BrokenLinksResult } from '@/lib/tools/broken-links'

const C = TOOLS.brokenLinks

export function BrokenLinkCheckerClient() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BrokenLinksResult | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(''); setResult(null)
    const normalized = url.trim()
    if (!normalized) { setError('Enter a URL'); return }
    setLoading(true)
    trackToolInteraction('broken-links', 'submitted')
    let outcome: ToolResultOutcome = 'network_error'
    try {
      const response = await fetch('/api/tools/broken-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: normalized }) })
      outcome = 'response_error'
      if (!response.ok) { outcome = 'api_error'; setError((await parseApiErrorResponse(response)).message); return }
      const data = await response.json() as BrokenLinksResult
      if (data.error) { outcome = 'application_error'; setError(data.error); return }
      outcome = 'succeeded'
      setResult(data)
    } catch {
      setError(SYSTEM_COPY.errors.genericRetry)
    } finally {
      trackToolInteraction('broken-links', outcome)
      setLoading(false)
    }
  }

  return <>
    <div className="space-y-4 text-center">
      <Badge variant="secondary" className="mx-auto w-fit">{C.badge}</Badge>
      <Heading as="h1" className="text-3xl md:text-4xl">{C.heading}</Heading>
      <p className="text-base leading-relaxed text-muted-foreground">{C.subhead}</p>
    </div>
    <ToolUrlForm url={url} onUrlChange={value => { setUrl(value); setError('') }} onSubmit={handleSubmit} loading={loading} error={error} ctaLabel={C.ctaScan} loadingLabel={C.loading} />
    {result ? <section aria-labelledby="broken-links-result" className="space-y-4">
      {result.checked === 0 ? <Card variant="strong" className="p-6 text-center"><h2 id="broken-links-result" className="font-semibold">{C.noLinks}</h2></Card>
        : result.broken.length === 0 ? <Card variant="strong" className="p-6 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-success" aria-hidden />
          <h2 id="broken-links-result" className="font-semibold">{C.clearHeading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{C.clearSubhead(result.checked)}</p>
        </Card>
        : <>
          <h2 id="broken-links-result" className="flex items-center gap-2 font-semibold"><Link2Off className="h-5 w-5 text-destructive" aria-hidden />{C.brokenHeading(result.broken.length)}</h2>
          <ul className="space-y-3">{result.broken.map(link => <li key={link.url}><Card variant="strong" className="p-4">
            <p className="break-all font-mono text-sm">{link.path}</p>
            <p className="mt-1 text-sm font-medium text-destructive">{C.status(link.status)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{C.linkText(link.text)}</p>
          </Card></li>)}</ul>
        </>}
      {result.checked > 0 ? <p className="text-center text-xs text-muted-foreground">{C.summary(result.checked, result.skipped)}</p> : null}
    </section> : null}
    <Card id="tool-audit" variant="strong" className="scroll-mt-24 p-6">
      <div className="space-y-3">
        <h2 className="font-semibold">{TOOLS.shared.auditHeading}</h2>
        <p className="text-sm text-muted-foreground">{TOOLS.shared.auditSubhead}</p>
        <AuditInput key={result?.url} source="tool_page" idSuffix="-broken-links" initialUrl={result?.url} showLandingExtras={false} />
      </div>
    </Card>
  </>
}
