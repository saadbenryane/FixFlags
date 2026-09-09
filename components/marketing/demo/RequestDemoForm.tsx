'use client'

import { useId, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading } from '@/components/ui/typography'
import { MarketingEyebrow } from '@/components/marketing/MarketingEyebrow'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { DEMO_PAGE } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'
import { toast } from 'sonner'
import type { CheckoutPlan } from '@/lib/billing/client-checkout'

interface RequestDemoFormProps {
  initialPlan: CheckoutPlan
}

export function RequestDemoForm({ initialPlan }: RequestDemoFormProps) {
  const nameId = useId()
  const emailId = useId()
  const websiteId = useId()
  const siteCountId = useId()
  const noteId = useId()
  const honeypotId = useId()
  const [plan, setPlan] = useState<CheckoutPlan>(initialPlan)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [siteCount, setSiteCount] = useState('')
  const [note, setNote] = useState('')
  const [company, setCompany] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const isStudio = plan === 'TEAM'
  const parsedSiteCount = useMemo(() => {
    const value = Number.parseInt(siteCount, 10)
    return Number.isInteger(value) && value > 0 ? value : undefined
  }, [siteCount])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          website: website.trim(),
          plan,
          siteCount: isStudio ? parsedSiteCount : undefined,
          note: note.trim() || undefined,
          company,
        }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        toast.error(payload?.message ?? DEMO_PAGE.failed)
        return
      }
      trackEvent('requested_demo', { plan, source: 'request-demo' })
      setSubmitted(true)
    } catch {
      toast.error(DEMO_PAGE.failed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Section spacing="tight" className="relative overflow-hidden">
      <Container variant="marketing" className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
        <MarketingEyebrow>{DEMO_PAGE.eyebrow}</MarketingEyebrow>
        <Heading
          as="h1"
          className="mt-4 font-display text-balance text-4xl font-bold leading-display tracking-display sm:text-5xl"
        >
          {DEMO_PAGE.headline}
        </Heading>
        <Body className="mt-4 max-w-xl text-muted-foreground text-pretty sm:text-lg">
          {DEMO_PAGE.subhead}
        </Body>

        {submitted ? (
          <div
            className="mt-8 space-y-4 rounded-card border border-border/60 bg-background/80 px-4 py-6 text-foreground shadow-sm"
            role="status"
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-brand" aria-hidden />
              {DEMO_PAGE.successTitle}
            </p>
            <p className="text-sm text-muted-foreground">{DEMO_PAGE.successBody}</p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSubmitted(false)
                  setNote('')
                }}
              >
                {DEMO_PAGE.anotherCta}
              </Button>
              <Button asChild variant="ghost">
                <Link href={'/pricing' as Route}>{DEMO_PAGE.pricingLink}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={(event) => void handleSubmit(event)}>
            <SegmentedControl
              size="md"
              value={plan}
              onValueChange={(value) => setPlan(value as CheckoutPlan)}
              items={[
                { value: 'BUILDER', label: DEMO_PAGE.planPro },
                { value: 'TEAM', label: DEMO_PAGE.planStudio },
              ]}
              aria-label={DEMO_PAGE.planLabel}
            />

            <div className="space-y-2">
              <Label htmlFor={nameId}>{DEMO_PAGE.nameLabel}</Label>
              <Input
                id={nameId}
                name="name"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={DEMO_PAGE.namePlaceholder}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={emailId}>{DEMO_PAGE.emailLabel}</Label>
              <Input
                id={emailId}
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={DEMO_PAGE.emailPlaceholder}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={websiteId}>{DEMO_PAGE.websiteLabel}</Label>
              <Input
                id={websiteId}
                name="website"
                type="text"
                inputMode="url"
                autoComplete="url"
                required
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder={DEMO_PAGE.websitePlaceholder}
              />
            </div>

            {isStudio ? (
              <div className="space-y-2">
                <Label htmlFor={siteCountId}>{DEMO_PAGE.siteCountLabel}</Label>
                <Input
                  id={siteCountId}
                  name="siteCount"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={siteCount}
                  onChange={(event) => setSiteCount(event.target.value)}
                  placeholder={DEMO_PAGE.siteCountPlaceholder}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor={noteId}>{DEMO_PAGE.noteLabel}</Label>
              <Textarea
                id={noteId}
                name="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={DEMO_PAGE.notePlaceholder}
              />
            </div>

            <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
              <label htmlFor={honeypotId}>Company</label>
              <input
                id={honeypotId}
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>

            <Button type="submit" loading={submitting} loadingLabel={DEMO_PAGE.submitting}>
              {DEMO_PAGE.submitCta}
            </Button>
          </form>
        )}
      </Container>
    </Section>
  )
}
