'use client'

import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Callout } from '@/components/ui/callout'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { cn } from '@/lib/utils'

export function FooterNewsletter({ className }: { className?: string }) {
  const {
    title,
    placeholder,
    cta,
    blurb,
    success: successMessage,
    alreadySubscribed,
    emailRequired,
    subscribeFailed,
  } = LANDING_PAGE.footer.newsletter
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const trimmed = email.trim()
    if (!trimmed) {
      setError(emailRequired)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'footer' }),
      })

      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res)
        setError(parsed.message)
        return
      }

      const data = await res.json()
      setSuccess(data.status === 'already_subscribed' ? alreadySubscribed : successMessage)
      setEmail('')
    } catch {
      setError(subscribeFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <p className="font-mono text-3xs font-semibold uppercase tracking-label text-foreground/85">
        {title}
      </p>
      <p className="max-w-[15rem] text-3xs leading-[1.55] text-muted-foreground">{blurb}</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="space-y-2">
          <label htmlFor="footer-newsletter-email" className="sr-only">Email address</label>
          <div className="flex items-center rounded-[var(--radius-control)] border border-border/70 bg-background p-1 shadow-sm focus-within:ring-2 focus-within:ring-focus-ring">
            <Input
              id="footer-newsletter-email"
              type="email"
              name="email"
              placeholder={placeholder}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
                setSuccess('')
              }}
              disabled={loading}
              className="h-11 min-h-11 min-w-0 flex-1 border-0 bg-transparent px-2.5 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-xs"
              autoComplete="email"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'footer-newsletter-error' : success ? 'footer-newsletter-success' : undefined}
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              loading={loading}
              loadingLabel={<span className="sr-only">Joining…</span>}
              className="h-11 min-h-11 w-11 min-w-11 shrink-0 border border-border/60 bg-muted/35 text-foreground hover:bg-muted"
              aria-label={cta}
            >
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
          {error ? (
            <Callout id="footer-newsletter-error" variant="danger" className="text-xs">
              {error}
            </Callout>
          ) : null}
          {success ? (
            <Callout id="footer-newsletter-success" variant="success" className="text-xs">
              {success}
            </Callout>
          ) : null}
        </div>
      </form>
    </div>
  )
}
