'use client'

import { useState } from 'react'
import { FileText, ExternalLink, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heading } from '@/components/ui/typography'
import { SYSTEM_COPY, TOOLS } from '@/lib/marketing/copy'
import { AuditInput } from '@/components/audit/AuditInput'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { trackToolInteraction, type ToolResultOutcome } from '@/lib/analytics/events'
import { ToolUrlForm } from '@/components/marketing/tools/ToolUrlForm'

interface PlaceholderMatch {
  type: 'placeholder' | 'template-copy' | 'ai-builder' | 'template-token' | 'social-proof'
  label: string
  match: string
  context: string
}

const TYPE_LABELS: Record<string, { label: string; color: 'destructive' | 'secondary' | 'outline' }> = {
  'placeholder': { label: 'Placeholder', color: 'destructive' },
  'template-copy': { label: 'Template Copy', color: 'secondary' },
  'ai-builder': { label: 'AI Builder Artifact', color: 'outline' },
  'template-token': { label: 'Template Token', color: 'destructive' },
  'social-proof': { label: 'Social proof', color: 'secondary' },
}

function severityClass(type: string): string {
  return type === 'placeholder' || type === 'template-token' ? 'border-l-destructive' : 'border-l-muted-foreground'
}

export function PlaceholderDetectorClient() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<PlaceholderMatch[]>([])
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [submittedUrl, setSubmittedUrl] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMatches([])
    setSearched(false)

    const normalized = url.trim()
    if (!normalized) {
      setError('Enter a URL')
      return
    }

    setLoading(true)
    trackToolInteraction('placeholder-detector', 'submitted')
    let outcome: ToolResultOutcome = 'network_error'
    try {
      const res = await fetch('/api/tools/placeholder-detector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      })
      outcome = 'response_error'
      if (!res.ok) {
        outcome = 'api_error'
        const err = await parseApiErrorResponse(res)
        setError(err.message)
        return
      }
      const data = await res.json()
      // Tool routes return domain failures as HTTP 200 with an error field.
      if (data.error) {
        outcome = 'application_error'
        setError(SYSTEM_COPY.errors.genericRetry)
        return
      }
      outcome = 'succeeded'
      setMatches(data.matches)
      setSubmittedUrl(normalized)
      setSearched(true)
    } catch {
      setError(SYSTEM_COPY.errors.genericRetry)
    } finally {
      trackToolInteraction('placeholder-detector', outcome)
      setLoading(false)
    }
  }

  const copy = TOOLS.placeholderDetector

  return (
    <>
      <div className="space-y-4 text-center">
        <Badge variant="secondary" className="mx-auto w-fit">{copy.badge}</Badge>
        <Heading as="h1" className="text-3xl md:text-4xl">{copy.heading}</Heading>
        <p className="text-base leading-relaxed text-muted-foreground">{copy.subhead}</p>
      </div>

      <ToolUrlForm
        url={url}
        onUrlChange={(value) => { setUrl(value); setError('') }}
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        ctaLabel={copy.ctaScan}
        loadingLabel="Scanning..."
      />

      {searched && matches.length === 0 && (
        <Card variant="strong" className="p-6 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
            <FileText className="h-6 w-6" aria-hidden />
          </div>
          <h2 className="font-semibold">{copy.noIssuesHeading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.noIssuesSubhead}</p>
        </Card>
      )}

      {matches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" aria-hidden />
            <h2 className="font-semibold">{matches.length} match{matches.length !== 1 ? 'es' : ''} found</h2>
          </div>

          <div className="space-y-3">
            {matches.map((match, i) => {
              const typeInfo = TYPE_LABELS[match.type] ?? { label: match.type, color: 'secondary' as const }
              return (
                <Card key={i} variant="strong" className={`${severityClass(match.type)} p-4`}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant={typeInfo.color} size="sm">{typeInfo.label}</Badge>
                    <span className="text-sm font-medium">{match.label}</span>
                  </div>
                  {match.match !== match.label && (
                    <p className="mb-1 text-xs text-muted-foreground">Matched: <code className="rounded bg-muted px-1 py-0.5 text-xs">{match.match}</code></p>
                  )}
                  <p className="text-sm leading-relaxed text-muted-foreground">{match.context}</p>
                </Card>
              )
            })}
          </div>

          <div className="flex justify-center pt-2">
            <Button variant="outline" asChild>
              <Link href="#tool-audit">
                {TOOLS.shared.ctaAudit}
                <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      )}

      <Card id="tool-audit" variant="strong" className="p-6 scroll-mt-24">
        <div className="space-y-3">
          <h2 className="font-semibold">{TOOLS.shared.auditHeading}</h2>
          <p className="text-sm text-muted-foreground">{TOOLS.shared.auditSubhead}</p>
          <AuditInput key={searched ? submittedUrl : undefined} source="tool_page" idSuffix="-placeholder-detector" initialUrl={searched ? submittedUrl : undefined} showLandingExtras={false} />
        </div>
      </Card>
    </>
  )
}
