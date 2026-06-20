'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

export function FooterNewsletter() {
  const { title, placeholder, cta, blurb, success: successMessage, alreadySubscribed } =
    LANDING_PAGE.footer.newsletter
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
      setError('Enter your email address')
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
      setError('Could not subscribe right now. Try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{blurb}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="space-y-1">
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
            className="h-10 flex-1"
            autoComplete="email"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'footer-newsletter-error' : success ? 'footer-newsletter-success' : undefined}
          />
          {error ? (
            <p id="footer-newsletter-error" role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          {success ? (
            <p id="footer-newsletter-success" role="status" className="text-xs text-success">
              {success}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="sm" disabled={loading} className="h-10 w-full px-5 sm:w-auto">
          {cta}
        </Button>
      </form>
    </div>
  )
}
