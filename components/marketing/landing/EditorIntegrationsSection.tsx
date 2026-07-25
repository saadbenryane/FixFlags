import Image from 'next/image'
import {
  Check,
  Crosshair,
  Gem,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

const INPUT_ICONS = {
  target: Crosshair,
  shield: ShieldCheck,
  wrench: Wrench,
  refresh: RefreshCw,
} as const

const OUTPUT_ICONS = {
  check: Check,
  trend: TrendingUp,
  diamond: Gem,
} as const

export function EditorIntegrationsSection() {
  const copy = LANDING_PAGE.editorIntegrations

  return (
    <Section
      spacing="marketing"
      id="integrations"
      className="scroll-mt-[var(--header-offset)] bg-muted/25"
    >
      <Container>
        <RevealOnView>
          <div className="overflow-hidden rounded-card bg-background p-6 shadow-card sm:p-8 lg:p-10">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-label text-brand sm:text-xs">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                    {copy.label}
                  </p>
                  <h2 className="font-display text-2xl font-semibold leading-display tracking-display text-balance sm:text-[1.75rem]">
                    {copy.headlineDisplay}
                    {copy.headlineAccentPeriod ? (
                      <span className="text-brand" aria-hidden>
                        .
                      </span>
                    ) : null}
                  </h2>
                  <p className="max-w-md text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
                    {copy.body}
                  </p>
                </div>

                <EditorToolMarks
                  showLabel={false}
                  className="[&_ul]:gap-2.5 [&_li]:rounded-full [&_li]:border [&_li]:border-border/60 [&_li]:bg-muted/40 [&_li]:px-3 [&_li]:py-2 [&_li]:text-xs [&_li]:font-medium [&_li]:text-foreground/80 [&_svg]:h-4 [&_svg]:w-4"
                />

                <p className="text-xs text-muted-foreground">{copy.moreComing}</p>
              </div>

              <WorkflowDiagram />
            </div>
          </div>
        </RevealOnView>
      </Container>
    </Section>
  )
}

function WorkflowDiagram() {
  const { inputs, outputs } = LANDING_PAGE.editorIntegrations.workflow

  return (
    <div
      aria-hidden
      className="relative mx-auto flex w-full max-w-lg items-center justify-center gap-3 sm:gap-5"
    >
      <ul className="flex flex-col gap-2.5">
        {inputs.map((item) => {
          const Icon = INPUT_ICONS[item.icon]
          return (
            <li
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-2 text-xs font-medium shadow-sm"
            >
              <Icon className="h-3.5 w-3.5 text-brand" strokeWidth={1.75} />
              {item.title}
            </li>
          )
        })}
      </ul>

      <div className="relative flex flex-col items-center">
        <div className="absolute inset-y-6 -left-3 w-px bg-gradient-to-b from-transparent via-brand/50 to-transparent sm:-left-4" />
        <div className="absolute inset-y-8 -right-3 w-px bg-gradient-to-b from-transparent via-brand/50 to-transparent sm:-right-4" />
        <div className="relative flex h-28 w-28 items-center justify-center rounded-[1.25rem] bg-gradient-to-b from-muted to-muted/40 shadow-card ring-1 ring-border/50 sm:h-32 sm:w-32">
          <div className="absolute inset-2 rounded-[1rem] bg-background/70 backdrop-blur-[2px]" />
          <Image
            src="/brand/logo-mark.png"
            alt=""
            width={56}
            height={56}
            unoptimized
            className="relative z-10 h-12 w-12 object-contain sm:h-14 sm:w-14"
          />
        </div>
        <div className="mt-3 h-3 w-24 rounded-sm bg-muted shadow-inner sm:w-28" />
      </div>

      <ul className="flex flex-col gap-2.5">
        {outputs.map((item) => {
          const Icon = OUTPUT_ICONS[item.icon]
          return (
            <li
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-2 text-xs font-medium shadow-sm"
            >
              <Icon className="h-3.5 w-3.5 text-brand" strokeWidth={1.75} />
              <span className="flex-1">{item.title}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
