'use client'

import { useState } from 'react'
import { ExternalLink, ImageIcon, Loader2, Search, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TOOLS } from '@/lib/marketing/copy'
import { AuditInput } from '@/components/audit/AuditInput'

interface MetaPreviewResult {
  url: string
  title: string | null
  description: string | null
  ogImage: string | null
  ogTitle: string | null
  ogDescription: string | null
  twitterCard: string | null
  twitterImage: string | null
  favicon: string | null
  hasCanonical: boolean
  hasRobots: boolean
  statusCode: number | null
  error: string | null
}

interface MetaFieldProps {
  label: string
  value: string | null
  missingLabel?: string
}

function MetaField({ label, value, missingLabel = 'Not set' }: MetaFieldProps) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      {value ? (
        <span className="break-all">{value}</span>
      ) : (
        <span className="flex items-center gap-1.5 text-destructive">
          <XCircle className="h-3.5 w-3.5" aria-hidden />
          {missingLabel}
        </span>
      )}
    </div>
  )
}

function SocialPreview({ result }: { result: MetaPreviewResult }) {
  const displayTitle = result.ogTitle ?? result.title ?? 'No title'
  const displayDesc = result.ogDescription ?? result.description ?? 'No description'
  const hasImage = !!result.ogImage

  return (
    <Card variant="solid" className="overflow-hidden">
      <div className="aspect-[1.91/1] bg-muted flex items-center justify-center">
        {hasImage ? (
          /* eslint-disable-next-line @next/next/no-img-element -- external user-supplied URL */
          <img
            src={result.ogImage!}
            alt="Social preview"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8" aria-hidden />
            <span className="text-xs">No og:image</span>
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-xs text-muted-foreground">{result.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
        <p className="font-semibold leading-snug">{displayTitle}</p>
        <p className="text-sm leading-snug text-muted-foreground line-clamp-2">{displayDesc}</p>
      </div>
    </Card>
  )
}

export function MetaPreviewClient() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MetaPreviewResult | null>(null)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)

    const normalized = url.trim()
    if (!normalized) {
      setError('Enter a URL')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/tools/meta-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
      }
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const copy = TOOLS.metaPreview

  return (
    <>
      <div className="space-y-4 text-center">
        <Badge variant="secondary" className="mx-auto w-fit">{copy.badge}</Badge>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{copy.heading}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">{copy.subhead}</p>
      </div>

      <Card variant="strong" className="p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <Input
            type="text"
            inputMode="url"
            placeholder="https://yoursite.com"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError('') }}
            disabled={loading}
            className="flex-1 text-base"
            aria-label="Website URL"
          />
          <Button type="submit" disabled={loading} className="shrink-0 gap-2">
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Checking...</>
            ) : (
              <><Search className="h-4 w-4" /> {copy.ctaCheck}</>
            )}
          </Button>
        </form>
        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" aria-hidden /> {error}
          </p>
        )}
      </Card>

      {result && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card variant="strong" className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-muted-foreground">{copy.metaTagsHeading.replace('Meta Tags', 'Social Preview')}</h2>
              <SocialPreview result={result} />
            </Card>

            <Card variant="strong" className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-muted-foreground">{copy.metaTagsHeading}</h2>
              <div className="space-y-3">
                <MetaField label={copy.metaFieldLabels.title} value={result.title} />
                <MetaField label={copy.metaFieldLabels.description} value={result.description} />
                <MetaField label={copy.metaFieldLabels.ogTitle} value={result.ogTitle} />
                <MetaField label={copy.metaFieldLabels.ogDescription} value={result.ogDescription} />
                <MetaField label={copy.metaFieldLabels.ogImage} value={result.ogImage} missingLabel={copy.missing} />
                <MetaField label={copy.metaFieldLabels.twitterCard} value={result.twitterCard} />
                <MetaField label={copy.metaFieldLabels.twitterImage} value={result.twitterImage} />
                <MetaField label={copy.metaFieldLabels.favicon} value={result.favicon} />
                <div className="flex items-center gap-4 pt-1">
                  <span className="flex items-center gap-1.5 text-sm">
                    {result.hasCanonical ? (
                      <><CheckCircle2 className="h-3.5 w-3.5 text-success" /> {copy.canonicalPresent}</>
                    ) : (
                      <><XCircle className="h-3.5 w-3.5 text-destructive" /> {copy.canonicalMissing}</>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm">
                    {result.hasRobots ? (
                      <><CheckCircle2 className="h-3.5 w-3.5 text-success" /> {copy.robotsPresent}</>
                    ) : (
                      <><XCircle className="h-3.5 w-3.5 text-muted-foreground" /> {copy.robotsMissing}</>
                    )}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button variant="outline" asChild>
              <Link href={`/report?url=${encodeURIComponent(result.url)}`}>
                {copy.ctaAudit}
                <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      )}

      <Card variant="strong" className="p-6">
        <div className="space-y-3">
          <h2 className="font-semibold">{copy.auditHeading}</h2>
          <p className="text-sm text-muted-foreground">{copy.auditSubhead}</p>
          <AuditInput source="tool_page" idSuffix="-meta-preview" />
        </div>
      </Card>
    </>
  )
}
