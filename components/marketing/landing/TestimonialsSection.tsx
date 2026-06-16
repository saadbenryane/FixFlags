import { Github, Linkedin } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Muted } from '@/components/ui/typography'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { LANDING_PAGE } from '@/lib/marketing/copy'

function NetworkIcon({ network }: { network: string }) {
  if (network === 'github') return <Github className="h-4 w-4" aria-hidden />
  if (network === 'linkedin') return <Linkedin className="h-4 w-4" aria-hidden />
  return (
    <span className="font-sans text-sm font-bold" aria-hidden>
      X
    </span>
  )
}

export function TestimonialsSection() {
  const { label, headline, disclaimer, items } = LANDING_PAGE.testimonials

  return (
    <Section
      spacing="marketing"
      id="testimonials"
      className="scroll-mt-[var(--header-offset)] bg-muted/20"
    >
      <Container className="space-y-12 sm:space-y-14">
        <LandingSectionHeader label={label} headline={headline} />

        <div className="grid gap-4 md:grid-cols-3 md:gap-5 lg:gap-6">
          {items.map((item) => (
            <Card key={item.name} className="flex h-full flex-col border-0 p-6 shadow-card">
              <blockquote className="flex-1 border-l-2 border-brand/35 pl-4 text-sm leading-relaxed text-foreground/90">
                {item.quote}
              </blockquote>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted font-sans text-sm font-semibold text-foreground">
                  {item.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.handle}</p>
                </div>
                <span className="text-muted-foreground/60" aria-hidden>
                  <NetworkIcon network={item.network} />
                </span>
              </div>
            </Card>
          ))}
        </div>

        <Muted className="text-center text-xs">{disclaimer}</Muted>
      </Container>
    </Section>
  )
}
