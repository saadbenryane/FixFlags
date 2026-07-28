import Image from 'next/image'
import {
  ArrowRight,
  Terminal,
} from 'lucide-react'
import { EditorMark } from '@/components/brand/EditorMarks'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

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
          className="mt-10 grid gap-12 sm:mt-12 sm:grid-cols-2 sm:gap-x-7 sm:gap-y-14 lg:grid-cols-4 lg:gap-8"
        >
          {copy.steps.map((step, index) => {
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
                      <Image
                        src={step.visual.src}
                        alt=""
                        width={step.visual.width}
                        height={step.visual.height}
                        sizes="176px"
                        loading="eager"
                        className={cn(
                          'h-[82%] w-[82%] select-none object-contain drop-shadow-[0_14px_18px_hsl(var(--brand)/0.16)]',
                          step.id === 'findings' && 'h-[90%] w-[90%]',
                        )}
                        draggable={false}
                      />
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
