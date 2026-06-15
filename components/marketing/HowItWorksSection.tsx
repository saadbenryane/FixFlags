import { ClipboardCopy, RefreshCw, Search } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { Heading } from '@/components/ui/typography'
import { HOW_IT_WORKS_SECTION } from '@/lib/marketing/copy'

const STEP_ICONS = [Search, ClipboardCopy, RefreshCw] as const

export function HowItWorksSection() {
  return (
    <Section spacing="default">
      <Container className="space-y-10">
        <SectionIntro
          label={HOW_IT_WORKS_SECTION.label}
          headline={HOW_IT_WORKS_SECTION.headline}
          subhead={HOW_IT_WORKS_SECTION.subhead}
        />

        <ol className="grid gap-8 md:grid-cols-3">
          {HOW_IT_WORKS_SECTION.steps.map((step, index) => {
            const Icon = STEP_ICONS[index] ?? Search
            return (
              <li key={step.step} className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-mono text-xs tabular-nums text-brand/80">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <Heading as="h3" className="text-xl">
                  {step.title}
                </Heading>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>
              </li>
            )
          })}
        </ol>
      </Container>
    </Section>
  )
}
