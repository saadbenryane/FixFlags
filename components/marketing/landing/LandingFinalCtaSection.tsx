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
        <div className="overflow-hidden rounded-card bg-background shadow-glass-deep">
          <div className="grid items-stretch lg:grid-cols-[0.92fr_1.08fr]">
            <div className="relative min-h-[15rem] overflow-hidden bg-muted/25 sm:min-h-[18rem] lg:min-h-[23rem]">
              <Image
                src="/marketing/visuals/final-cta-gateway-v2.webp"
                alt="A live URL passes through a review gateway and becomes an actionable Flag"
                fill
                sizes="(min-width: 1280px) 620px, (min-width: 1024px) 46vw, 100vw"
                className="scale-[1.08] object-contain object-left-center drop-shadow-[0_28px_44px_hsl(var(--foreground)/0.1)]"
                unoptimized
              />
              <div className="absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(to_right,transparent,hsl(var(--background)))]" />
            </div>

            <div className="flex flex-col justify-center px-5 pb-7 sm:px-8 sm:pb-9 lg:-ml-6 lg:px-12 lg:py-12">
              <LandingSectionHeader
                align="left"
                headline={FINAL_CTA.headlineDisplay}
                accentPeriod={FINAL_CTA.headlineAccentPeriod}
                subhead={FINAL_CTA.body}
                className="max-w-xl [&_h2]:max-w-[18ch] [&_h2]:!text-3xl [&_h2]:!leading-display sm:[&_h2]:!text-4xl"
              />

              <div className="mt-6 w-full max-w-2xl">
                <AuditInput
                  variant="landing"
                  idSuffix="-final-cta"
                  ctaPlacement="final"
                  showLandingExtras={false}
                />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
