import Image from 'next/image'
import {
  ArrowRight,
  CircleAlert,
  CircleCheckBig,
  Info,
  ListChecks,
  Plug,
  Terminal,
} from 'lucide-react'
import { EditorMark } from '@/components/brand/EditorMarks'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const STEP_VISUALS = {
  connect: ConnectVisual,
  review: ReviewVisual,
  findings: FindingsVisual,
  ship: ShipVisual,
} as const

export function EditorIntegrationsSection() {
  const copy = LANDING_PAGE.editorIntegrations

  return (
    <Section
      spacing="marketing"
      tint="subtle"
      id="integrations"
      className="scroll-mt-[var(--header-offset)] overflow-hidden py-12 sm:py-14 lg:py-14"
    >
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <header className="mx-auto max-w-[48rem] text-center">
            <p className="inline-flex items-center justify-center gap-2 font-mono text-[0.6875rem] font-semibold uppercase tracking-label text-brand sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
              {copy.label}
            </p>
            <h2 className="mt-4 text-balance font-display text-[2.25rem] font-bold leading-[1.02] tracking-display text-foreground sm:text-[2.75rem] lg:text-[3rem]">
              <span className="block">{copy.headlineLines[0]}</span>
              <span className="block">
                {copy.headlineLines[1]}
                <span className="text-brand" aria-hidden>
                  .
                </span>
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-[39rem] text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
              {copy.body}
            </p>
          </header>
        </RevealOnView>

        <ol
          data-design-qa="editor-workflow"
          className="mt-10 grid gap-12 sm:mt-12 sm:grid-cols-2 sm:gap-x-7 sm:gap-y-14 lg:grid-cols-4 lg:gap-8"
        >
          {copy.steps.map((step, index) => {
            const Visual = STEP_VISUALS[step.visual]

            return (
              <RevealOnView key={step.id}>
                <li className="relative flex h-full flex-col">
                  <div className="min-h-[6.25rem]">
                    <p className="font-mono text-xs font-semibold tabular-nums text-brand">
                      {String(index + 1).padStart(2, '0')}
                    </p>
                    <h3 className="mt-2 font-display text-base font-semibold tracking-heading text-foreground sm:text-[1.0625rem]">
                      {step.title}
                    </h3>
                    <p className="mt-2 max-w-[17rem] text-[0.8125rem] leading-[1.55] text-muted-foreground">
                      {step.body}
                    </p>
                  </div>

                  <div className="relative mt-4">
                    <div className="workflow-glass-tile mx-auto flex aspect-square w-full max-w-[11rem] items-center justify-center rounded-[1.35rem]">
                      <Visual />
                    </div>
                    {index < copy.steps.length - 1 ? (
                      <span
                        className="absolute left-[calc(100%+0.5rem)] top-1/2 hidden -translate-y-1/2 text-foreground/75 lg:inline-flex"
                        aria-hidden
                      >
                        <ArrowRight className="h-7 w-7" strokeWidth={1.35} />
                      </span>
                    ) : null}
                  </div>

                  <StepNote step={step} />
                </li>
              </RevealOnView>
            )
          })}
        </ol>
      </Container>
    </Section>
  )
}

function StepNote({
  step,
}: {
  step: (typeof LANDING_PAGE.editorIntegrations.steps)[number]
}) {
  if (step.note.type === 'tools') {
    return (
      <div className="workflow-note mx-auto mt-4 flex min-h-12 w-full max-w-[13.75rem] items-center justify-center gap-3 rounded-[0.8rem] px-3 py-2 text-[0.6875rem] font-semibold text-foreground/85 lg:max-w-none">
        {step.note.items.map((tool) => (
          <span key={tool} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            {tool === 'CLI' ? (
              <Terminal className="h-3.5 w-3.5 text-foreground" strokeWidth={2} aria-hidden />
            ) : (
              <EditorMark
                name={tool}
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  tool === 'Lovable' ? 'text-brand' : 'text-foreground',
                )}
              />
            )}
            {tool}
          </span>
        ))}
      </div>
    )
  }

  return (
    <p className="workflow-note mx-auto mt-4 flex min-h-12 w-full max-w-[13.75rem] items-center justify-center rounded-[0.8rem] px-4 py-2 text-center text-[0.6875rem] leading-[1.4] text-muted-foreground lg:max-w-none">
      {step.note.text}
    </p>
  )
}

function ConnectVisual() {
  return (
    <Plug
      className="h-[4.75rem] w-[4.75rem] -rotate-45 text-brand drop-shadow-[0_14px_14px_hsl(var(--brand)/0.2)]"
      strokeWidth={2.4}
      aria-hidden
    />
  )
}

function ReviewVisual() {
  return (
    <div className="relative flex h-[6.5rem] w-[6.5rem] items-center justify-center">
      <CircleCheckBig
        className="h-full w-full text-brand drop-shadow-[0_14px_14px_hsl(var(--brand)/0.16)]"
        strokeWidth={1.65}
        aria-hidden
      />
    </div>
  )
}

function FindingsVisual() {
  return (
    <div className="relative w-[7.75rem]">
      <ListChecks className="absolute inset-0 h-full w-full text-border/35" aria-hidden />
      <div className="space-y-2.5">
        <FindingRow icon={CircleAlert} tone="brand" />
        <FindingRow icon={CircleAlert} tone="warning" />
        <FindingRow icon={Info} tone="info" />
      </div>
    </div>
  )
}

function FindingRow({
  icon: Icon,
  tone,
}: {
  icon: typeof CircleAlert
  tone: 'brand' | 'warning' | 'info'
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon
        className={cn(
          'h-[1.15rem] w-[1.15rem] shrink-0',
          tone === 'brand' && 'text-brand',
          tone === 'warning' && 'text-warning',
          tone === 'info' && 'text-info',
        )}
        strokeWidth={1.8}
        aria-hidden
      />
      <span className="workflow-finding-line h-5 flex-1 rounded-full" />
    </div>
  )
}

function ShipVisual() {
  return (
    <Image
      src="/brand/logo-mark.png"
      alt=""
      width={512}
      height={512}
      sizes="96px"
      className="h-24 w-24 object-contain drop-shadow-[0_16px_16px_hsl(var(--brand)/0.2)]"
      unoptimized
      draggable={false}
    />
  )
}
