import { ClipboardCheck, Globe, RefreshCw } from 'lucide-react'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

const STEP_ICONS = [ClipboardCheck, Globe, RefreshCw] as const

export function LandingHowItWorksSection() {
  const copy = LANDING_PAGE.howItWorks

  return (
    <Section spacing="compact" className="bg-background">
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <LandingSectionHeader
          label={copy.label}
          headline={copy.headlineDisplay}
          accentPeriod={copy.headlineAccentPeriod}
          subhead={copy.subhead}
          className="mb-8 sm:mb-10"
        />
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {copy.steps.map((step, i) => {
            const Icon = STEP_ICONS[i]
            return (
              <div
                key={step.step}
                className="relative flex flex-col gap-3 rounded-card border border-border/50 bg-card/60 p-5 shadow-card glass-surface"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Step {step.step}
                </p>
                <h3 className="text-sm font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}
