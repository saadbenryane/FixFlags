import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Lock, ShieldCheck, Zap } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { FINAL_CTA, HERO } from '@/lib/marketing/copy'

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

const ASSURANCE_ICONS = {
  shield: ShieldCheck,
  lock: Lock,
  zap: Zap,
} as const

export function LandingFinalCtaSection() {
  return (
    <Section spacing="marketing" className="pb-7 sm:pb-8">
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
              <div className="space-y-2.5">
                <h2 className="font-display text-2xl font-semibold leading-display tracking-display text-balance sm:text-[1.75rem] md:text-[2rem]">
                  {FINAL_CTA.headlineDisplay}
                  {FINAL_CTA.headlineAccentPeriod ? (
                    <span className="text-brand" aria-hidden>
                      .
                    </span>
                  ) : null}
                </h2>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
                  {FINAL_CTA.body}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <AuditInput
                variant="landing"
                idSuffix="-final-cta"
                ctaPlacement="final"
                showLandingExtras={false}
              />
              <ul className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-0">
                {HERO.assurances.map((item, index) => {
                  const Icon = ASSURANCE_ICONS[item.icon]
                  return (
                    <li
                      key={item.id}
                      className="inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground sm:text-sm"
                    >
                      {index > 0 ? (
                        <span
                          aria-hidden
                          className="mx-3 hidden h-3.5 w-px shrink-0 bg-border sm:inline-block"
                        />
                      ) : null}
                      <Icon
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <span>{item.label}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
