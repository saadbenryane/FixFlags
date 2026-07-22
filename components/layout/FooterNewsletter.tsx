'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Callout } from '@/components/ui/callout'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

export function FooterNewsletter() {
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
    <div className="space-y-3 lg:col-span-1">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{blurb}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="space-y-2">
          <label htmlFor="footer-newsletter-email" className="sr-only">Email address</label>
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
            className="h-11"
            autoComplete="email"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'footer-newsletter-error' : success ? 'footer-newsletter-success' : undefined}
          />
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
        <Button type="submit" size="sm" disabled={loading} className="h-11 w-full px-5 sm:w-auto">
          {cta}
        </Button>
      </form>
    </div>
  )
}
