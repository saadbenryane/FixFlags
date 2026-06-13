'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { HERO } from '@/lib/marketing/copy'
import { parseApiErrorResponse } from '@/lib/api/errors'

export function AuditInput() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [urlError, setUrlError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUrlError('')

    let normalized = url.trim()
    if (!normalized) return

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
        const message = await parseApiErrorResponse(res)
        toast.error(message)
        return
      }

      const data = await res.json()
      router.push(`/audit/${data.auditId}`)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full max-w-2xl">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="https://yoursite.com"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setUrlError('') }}
          className="h-12 text-base flex-1"
          disabled={loading}
          autoFocus
        />
        <Button type="submit" size="lg" disabled={loading || !url.trim()} className="h-12 px-6 gap-2 shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {HERO.primaryCta}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
      {urlError && (
        <p className="text-xs text-destructive">{urlError}</p>
      )}
    </form>
  )
}
