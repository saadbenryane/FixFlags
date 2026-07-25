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
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
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
      tint="subtle"
      id="integrations"
      className="scroll-mt-[var(--header-offset)]"
    >
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <div className="overflow-hidden rounded-card bg-background p-6 shadow-card sm:p-8 lg:p-10">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
              <div className="space-y-6">
                <LandingSectionHeader
                  align="left"
                  label={copy.label}
                  brandEyebrow
                  headline={copy.headlineDisplay}
                  accentPeriod={copy.headlineAccentPeriod}
                  subhead={copy.body}
                  size="sm"
                  className="max-w-md"
                />

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
      className="relative mx-auto flex w-full max-w-lg flex-col items-center gap-5 sm:gap-6 md:flex-row md:items-center md:justify-center md:gap-5"
    >
      <ul className="flex w-full flex-row flex-wrap justify-center gap-2 md:w-auto md:flex-col md:flex-nowrap md:gap-2.5">
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
        <div className="absolute inset-y-6 -left-3 hidden w-px bg-gradient-to-b from-transparent via-brand/50 to-transparent md:block md:-left-4" />
        <div className="absolute inset-y-8 -right-3 hidden w-px bg-gradient-to-b from-transparent via-brand/50 to-transparent md:block md:-right-4" />
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

      <ul className="flex w-full flex-row flex-wrap justify-center gap-2 md:w-auto md:flex-col md:flex-nowrap md:gap-2.5">
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
