import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { HERO } from '@/lib/marketing/copy'

const TRUST_BADGES = [
  'No sign-up required',
  'Results in seconds',
  'Live or preview URLs',
]

export function LandingFinalCtaSection() {
  return (
    <Section spacing="marketing" className="pb-16 sm:pb-20">
      <Container>
        <div className="relative overflow-hidden rounded-card p-8 glass-surface-strong shadow-card sm:p-12 lg:p-16">
          <div className="relative z-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
                Before you ship it,{' '}
                <span className="relative inline-block bg-gradient-peach-accent bg-clip-text text-transparent">
                  flag it.
                  <svg
                    aria-hidden
                    className="absolute -bottom-1 left-0 w-full"
                    viewBox="0 0 100 8"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0 6 Q25 2 50 5 Q75 8 100 4"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      className="text-brand/80"
                    />
                  </svg>
                </span>
              </h2>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                Run a free check on any live or preview URL. Get the issues that matter and the fixes your agent can apply.
              </p>
              <Button variant="gradient" size="lg" className="h-12 gap-2 px-7" asChild>
                <Link href="/#audit">
                  {HERO.primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="flex flex-col gap-4">
              {TRUST_BADGES.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-4 rounded-card px-5 py-4 glass-surface shadow-sm"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15">
                    <Check className="h-4 w-4 text-brand" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-foreground">{badge}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
