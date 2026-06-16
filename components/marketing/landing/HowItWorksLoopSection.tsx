import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function HowItWorksLoopSection() {
  const { headline, steps } = LANDING_PAGE.howItWorks

  return (
    <Section spacing="loose" id="how-it-works" className="scroll-mt-[var(--header-offset)] bg-muted/20">
      <Container className="space-y-10 sm:space-y-12">
        <Heading as="h2" className="mx-auto max-w-2xl text-center">
          {headline}
        </Heading>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          {steps.map((step, index) => (
            <div key={step.step} className="relative">
              <Card className="flex h-full flex-col border-0 p-5 shadow-card sm:p-6">
                <p className="font-mono text-[11px] uppercase tracking-label text-muted-foreground">
                  {step.step}. {step.title}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {step.body}
                </p>
                <div className="mt-5 rounded-nested-md bg-muted/40 px-3 py-2.5 font-mono text-xs text-foreground/90">
                  {step.preview}
                </div>
              </Card>
              {index < steps.length - 1 ? (
                <ArrowRight
                  aria-hidden
                  className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/50 xl:block"
                />
              ) : null}
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
