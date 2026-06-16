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
        {/* Soft peach gradient card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-50 via-amber-50 to-pink-50 p-8 sm:p-12 lg:p-16 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-pink-950/30">
          {/* background blob */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,hsl(24_100%_70%/0.2),transparent_70%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -left-10 h-60 w-60 rounded-full bg-[radial-gradient(circle,hsl(340_80%_70%/0.1),transparent_70%)]"
          />

          <div className="relative grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Left */}
            <div className="space-y-6">
              <h2 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
                Before you ship it,{' '}
                <span className="relative inline-block text-orange-500">
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
                      className="text-orange-400"
                    />
                  </svg>
                </span>
              </h2>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                Run a free check on any live or preview URL. Get the issues that matter and the fixes your agent can apply.
              </p>
              <Button
                size="lg"
                className="h-12 gap-2 rounded-full bg-orange-500 px-7 text-white hover:bg-orange-600"
                asChild
              >
                <Link href="/#audit">
                  {HERO.primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            {/* Right: trust badges */}
            <div className="flex flex-col gap-4">
              {TRUST_BADGES.map((badge) => (
                <div
                  key={badge}
                  className="flex items-center gap-4 rounded-2xl border border-orange-200/50 bg-white/60 px-5 py-4 backdrop-blur-sm dark:border-orange-800/30 dark:bg-white/5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                    <Check className="h-4 w-4 text-emerald-500" aria-hidden />
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
