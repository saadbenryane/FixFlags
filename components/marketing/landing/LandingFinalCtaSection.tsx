import dynamic from 'next/dynamic'
import Image from 'next/image'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { FINAL_CTA } from '@/lib/marketing/copy'

const AuditInput = dynamic(
  () => import('@/components/audit/AuditInput').then((m) => m.AuditInput),
  {
    ssr: true,
    loading: () => (
      <div
        aria-hidden
        className="h-14 w-full animate-pulse rounded-[var(--radius-control)] bg-muted/45"
      />
    ),
  },
)

export function LandingFinalCtaSection() {
  return (
    <Section
      id="final-cta"
      spacing="compact"
      className="scroll-mt-[var(--header-offset)] bg-muted/15"
    >
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <div className="rounded-[1rem] border border-border/50 bg-background p-5 shadow-card sm:p-6 lg:p-7">
          <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
            <div className="flex items-start gap-4 sm:gap-5 lg:gap-10">
              <div className="relative hidden h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-[0.875rem] bg-muted/55 shadow-sm sm:flex">
                <Image
                  src="/marketing/visuals/pricing-glass-mark.webp"
                  alt=""
                  fill
                  sizes="72px"
                  className="rounded-[0.875rem] object-cover"
                />
              </div>
              <LandingSectionHeader
                align="left"
                headline={FINAL_CTA.headlineDisplay}
                accentPeriod={FINAL_CTA.headlineAccentPeriod}
                className="max-w-[25rem] space-y-2 [&_h2]:max-w-[14rem] [&_h2]:!text-xl [&_h2]:!leading-display"
              />
            </div>

            <div>
              <AuditInput
                variant="landing"
                idSuffix="-final-cta"
                ctaPlacement="final"
                showLandingExtras={false}
              />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
