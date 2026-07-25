import dynamic from 'next/dynamic'
import Image from 'next/image'
import { AssuranceRow } from '@/components/marketing/landing/AssuranceRow'
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
  }
)

export function LandingFinalCtaSection() {
  return (
    <Section
      id="final-cta"
      spacing="marketing"
      className="scroll-mt-[var(--header-offset)] pb-7 sm:pb-8"
    >
      <Container>
        <div className="rounded-card border border-border/50 bg-background p-6 shadow-card sm:p-8 lg:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="relative hidden h-16 w-16 shrink-0 items-center justify-center rounded-[1rem] bg-muted/60 shadow-sm sm:flex">
                <Image
                  src="/brand/logo-mark.png"
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className="h-9 w-9 object-contain"
                />
              </div>
              <LandingSectionHeader
                align="left"
                headline={FINAL_CTA.headlineDisplay}
                accentPeriod={FINAL_CTA.headlineAccentPeriod}
                subhead={FINAL_CTA.body}
                className="max-w-md space-y-2.5"
              />
            </div>

            <div className="space-y-4">
              <AuditInput
                variant="landing"
                idSuffix="-final-cta"
                ctaPlacement="final"
                showLandingExtras={false}
              />
              <AssuranceRow />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
