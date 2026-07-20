import dynamic from 'next/dynamic'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { BrandIllustration } from '@/components/marketing/landing/BrandIllustration'
import { FINAL_CTA } from '@/lib/marketing/copy'

const AuditInput = dynamic(
  () => import('@/components/audit/AuditInput').then((m) => m.AuditInput),
  {
    ssr: true,
    loading: () => (
      <div
        aria-hidden
        className="h-14 w-full animate-pulse rounded-full bg-muted/45"
      />
    ),
  }
)

export function LandingFinalCtaSection() {
  return (
    <Section spacing="marketing" className="pb-7 sm:pb-8">
      <Container>
        <div className="relative overflow-hidden rounded-card p-8 glass-surface-strong shadow-card sm:p-12 lg:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-28 h-72 bg-[radial-gradient(ellipse_60%_55%_at_72%_35%,hsl(var(--brand)/0.18),transparent_68%)] blur-[80px]"
          />
          <BrandIllustration
            sizes="(min-width: 1024px) 260px, 0px"
            className="absolute -bottom-28 -right-8 hidden h-96 w-72 opacity-50 [mask-image:radial-gradient(ellipse_68%_72%_at_52%_55%,black_30%,transparent_78%)] lg:block dark:hidden xl:right-2"
            imageClassName="scale-110 object-[50%_58%]"
          />
          <div className="relative z-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-6">
              <h2 className="font-serif text-4xl font-medium leading-display tracking-display text-balance text-foreground sm:text-5xl">
                {FINAL_CTA.headline}{' '}
                <span className="text-brand">
                  {FINAL_CTA.headlineAccent}
                </span>
              </h2>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                {FINAL_CTA.body}
              </p>
            </div>

            <div className="space-y-5">
              <AuditInput variant="landing" idSuffix="-final-cta" ctaPlacement="final" />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
