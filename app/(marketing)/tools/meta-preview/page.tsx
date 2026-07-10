'use client'

import { useState } from 'react'
import { ExternalLink, ImageIcon, Loader2, Search, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
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
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
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
    </div>
  )
}

export default function MetaPreviewPage() {
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

  return (
    <>
      <Section spacing="marketing">
        <Container variant="narrow" className="space-y-8">
          <div className="space-y-4 text-center">
            <Badge variant="secondary" className="mx-auto w-fit">Free Tool</Badge>
            <Heading as="h1">Meta Preview Tool</Heading>
            <p className="text-base leading-relaxed text-muted-foreground">
              See how your page looks when shared on Slack, X, LinkedIn, and Discord.
              Enter a URL to check its og:image, title, and description tags.
            </p>
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
                  <><Search className="h-4 w-4" /> Check preview</>
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
                  <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Social Preview</h2>
                  <SocialPreview result={result} />
                </Card>

                <Card variant="strong" className="p-5">
                  <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Meta Tags</h2>
                  <div className="space-y-3">
                    <MetaField label="Title" value={result.title} />
                    <MetaField label="Description" value={result.description} />
                    <MetaField label="og:title" value={result.ogTitle} />
                    <MetaField label="og:description" value={result.ogDescription} />
                    <MetaField label="og:image" value={result.ogImage} missingLabel="Missing" />
                    <MetaField label="twitter:card" value={result.twitterCard} />
                    <MetaField label="twitter:image" value={result.twitterImage} />
                    <MetaField label="Favicon" value={result.favicon} />
                    <div className="flex items-center gap-4 pt-1">
                      <span className="flex items-center gap-1.5 text-sm">
                        {result.hasCanonical ? (
                          <><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Canonical</>
                        ) : (
                          <><XCircle className="h-3.5 w-3.5 text-destructive" /> No canonical</>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm">
                        {result.hasRobots ? (
                          <><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Robots meta</>
                        ) : (
                          <><XCircle className="h-3.5 w-3.5 text-muted-foreground" /> No robots meta</>
                        )}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="flex justify-center">
                <Button variant="outline" asChild>
                  <a href={`/report?url=${encodeURIComponent(result.url)}`}>
                    Run full audit on this URL
                    <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
                  </a>
                </Button>
              </div>
            </div>
          )}

          <Card variant="strong" className="p-6">
            <div className="space-y-3">
              <h2 className="font-semibold">Run a full audit</h2>
              <p className="text-sm text-muted-foreground">
                Get a complete report across Message, Experience, and Reach with fix prompts your AI agent can run.
              </p>
              <AuditInput source="tool_page" idSuffix="-meta-preview" />
            </div>
          </Card>
        </Container>
      </Section>
    </>
  )
}
