'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function FooterNewsletter() {
  const { title, placeholder, cta, blurb } = LANDING_PAGE.footer.newsletter
  const [email, setEmail] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      toast.error('Enter your email address')
      return
    }

    toast.success('Thanks — we will keep you posted.')
    setEmail('')
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{blurb}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="footer-newsletter-email" className="sr-only">Email address</label>
        <Input
          id="footer-newsletter-email"
          type="email"
          name="email"
          placeholder={placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 flex-1"
          autoComplete="email"
        />
        <Button type="submit" variant="ink" size="sm" className="h-10 shrink-0 px-5">
          {cta}
        </Button>
      </form>
    </div>
  )
}
