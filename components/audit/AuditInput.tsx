'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { HERO } from '@/lib/marketing/copy'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { AuditLimitGate } from '@/components/audit/AuditLimitGate'
import { setActiveAudit } from '@/lib/audit/active-audit'

export function AuditInput() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [limitGate, setLimitGate] = useState<{
    message: string
    code?: string
    action?: string
  } | null>(null)

  async function submitUrl() {
    setUrlError('')
    setLimitGate(null)

    let normalized = url.trim()
    if (!normalized) {
      setUrlError('Enter a URL like https://yoursite.com')
      return
    }

    normalized = normalized.replace(/\/+$/, '')

    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized
    }

    try {
      new URL(normalized)
    } catch {
      setUrlError('Enter a valid URL like https://yoursite.com')
      return
    }

    if (normalized.includes('localhost') || normalized.includes('127.0.0.1') || normalized.includes('0.0.0.0')) {
      setUrlError('QualityOS can only audit publicly accessible URLs')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      })

      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res)
        if (res.status === 402) {
          setLimitGate(parsed)
        } else {
          toast.error(parsed.message)
        }
        return
      }

      const data = await res.json()
      setActiveAudit({
        auditId: data.auditId,
        url: normalized,
        queuePosition: data.queuePosition,
        estimatedWaitSeconds: data.estimatedWaitSeconds,
        queueReason: data.queueReason,
      })
      router.push(`/audit/${data.auditId}`)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitUrl()
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <label htmlFor="audit-url" className="sr-only">
            Public website URL
          </label>
          <Input
            id="audit-url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="https://yoursite.com"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError('') }}
            className="h-12 text-base flex-1"
            disabled={loading}
            aria-invalid={Boolean(urlError)}
            aria-describedby={urlError ? 'audit-url-error' : undefined}
          />
          <Button type="submit" size="lg" disabled={loading} className="h-12 px-6 gap-2 shrink-0">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Auditing…
              </>
            ) : (
              <>
                {HERO.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
        {urlError && (
          <p id="audit-url-error" role="alert" className="text-xs text-destructive">
            {urlError}
          </p>
        )}
      </form>

      {limitGate && (
        <AuditLimitGate
          message={limitGate.message}
          code={limitGate.code}
          action={limitGate.action}
          onDismiss={() => setLimitGate(null)}
        />
      )}
    </div>
  )
}
