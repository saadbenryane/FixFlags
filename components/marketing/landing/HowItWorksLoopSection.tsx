import { ArrowRight, Globe, Flag, Sparkles, CheckCircle2 } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    num: '01',
    title: 'Scan',
    body: 'We scan your live site in seconds.',
    Icon: Globe,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    preview: {
      label: 'yourproduct.com',
      badge: null,
      badgeColor: '',
      indicator: <span className="h-2 w-2 rounded-full bg-emerald-400" />,
    },
  },
  {
    num: '02',
    title: 'Flag',
    body: 'We surface the issues that actually matter.',
    Icon: Flag,
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-500',
    preview: {
      label: 'high-impact flags',
      badge: '7',
      badgeColor: 'bg-orange-500 text-white',
      indicator: null,
    },
  },
  {
    num: '03',
    title: 'Fix',
    body: 'Your AI agent gets exact prompts and context.',
    Icon: Sparkles,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-500',
    preview: {
      label: 'Agent-ready fix',
      badge: null,
      badgeColor: '',
      indicator: <Sparkles className="h-3 w-3 text-purple-400" />,
    },
  },
  {
    num: '04',
    title: 'Verify',
    body: 'We re-check and show what improved.',
    Icon: CheckCircle2,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    preview: {
      label: 'Score improved',
      badge: '+32%',
      badgeColor: 'bg-emerald-500/15 text-emerald-500',
      indicator: null,
    },
  },
]

export function HowItWorksLoopSection() {
  return (
    <Section
      spacing="marketing"
      id="how-it-works"
      className="scroll-mt-[var(--header-offset)] bg-muted/20"
    >
      <Container className="space-y-12 sm:space-y-16">
        <LandingSectionHeader label="HOW IT WORKS" headline="From scan to ship. In one loop." />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          {STEPS.map((step, index) => (
            <div key={step.num} className="relative">
              <div className="flex h-full flex-col rounded-2xl border border-border/50 bg-card p-5 shadow-md transition-shadow hover:shadow-lg sm:p-6">
                {/* icon + number */}
                <div className="mb-4 flex items-center justify-between">
                  <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-xl', step.iconBg)}>
                    <step.Icon className={cn('h-5 w-5', step.iconColor)} aria-hidden />
                  </span>
                  <span className="font-mono text-3xl font-bold tabular-nums text-muted-foreground/20">
                    {step.num}
                  </span>
                </div>

                <p className="text-base font-bold">{step.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {step.body}
                </p>

                {/* preview chip */}
                <div className="mt-5 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5">
                  {step.preview.indicator}
                  {step.preview.badge && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', step.preview.badgeColor)}>
                      {step.preview.badge}
                    </span>
                  )}
                  <span className="font-mono text-xs text-foreground/80">{step.preview.label}</span>
                </div>
              </div>

              {/* connector arrow */}
              {index < STEPS.length - 1 && (
                <ArrowRight
                  aria-hidden
                  className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-muted-foreground/30 xl:block"
                />
              )}
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
