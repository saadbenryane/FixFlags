import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { rubricIcon } from '@/lib/rubric-icons'
import {
  SampleSectionCta,
  SampleViewTracker,
} from '@/components/marketing/landing/SampleFunnelEvents'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import type { CuratedSampleAudit } from '@/lib/marketing/curated-sample'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface SampleReportSectionProps {
  audit?: CuratedSampleAudit
}

export function SampleReportSection({ audit }: SampleReportSectionProps) {
  const copy = LANDING_PAGE.sampleReport
  const report = buildSampleReportDisplay(audit ?? getStaticSampleAudit())
  const flagCount = report.flags.length

  return (
    <Section
      spacing="compact"
      tint="subtle"
      className="py-6 sm:py-7 lg:py-7"
    >
      <SampleViewTracker placement="homepage" />
      <Container
        id="sample-review"
        className="scroll-mt-[calc(var(--header-height-marketing)+1rem)] space-y-5 px-4 sm:space-y-5 sm:px-6 lg:space-y-5 lg:px-12"
        variant="marketing"
      >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.64fr)_minmax(0,1.36fr)] lg:gap-7 xl:gap-9">
          <RevealOnView className="flex flex-col gap-3.5 sm:gap-4">
            <LandingSectionHeader
              align="left"
              label={copy.label}
              brandEyebrow
              headline={copy.headlineDisplay}
              accentPeriod={copy.headlineAccentPeriod}
              subhead={copy.body}
              size="lg"
              className="max-w-md space-y-3 sm:space-y-4"
            />

            <ul className="flex flex-col gap-1.5">
              {copy.rubricRows.map((row) => {
                const Icon = rubricIcon(row.icon)
                const count = report.flags.filter(
                  (flag) => flag.rubric.toLowerCase() === row.id
                ).length
                return (
                  <li key={row.id}>
                    <Link
                      href="/samples"
                      className={cn(
                        'group flex min-h-11 items-center gap-3 rounded-[var(--radius-inner)] border border-border/45 bg-background/90 px-3.5 py-1.5 sm:px-4',
                        'shadow-glass-subtle',
                        'transition-[background-color,box-shadow,border-color,transform] duration-200 ease-out',
                        'hover:border-border/65 hover:bg-background hover:shadow-glass',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
                      )}
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand/10 text-brand">
                        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {row.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground text-pretty">
                          {row.body}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-2 pl-1">
                        <span className="text-[0.6875rem] font-medium tabular-nums text-brand/70">
                          {count} {count === 1 ? 'Flag' : 'Flags'}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 text-muted-foreground/70 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-foreground"
                          aria-hidden
                        />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <SampleSectionCta flagCount={flagCount} />
          </RevealOnView>

          <div className="min-w-0">
            <Link
              href="/samples"
              aria-label="Explore the complete generated sample Finish Plan"
              className="group block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4"
            >
              <Image
                src="/marketing/visuals/sample-report-workspace-v3.png"
                alt="Generated FixFlags sample Finish Plan with seven Flags across Message, Experience, and Reach."
                width={1536}
                height={1024}
                sizes="(min-width: 1024px) 66vw, 100vw"
                loading="lazy"
                className="h-auto w-full select-none object-contain drop-shadow-[0_26px_42px_hsl(240_8%_5%/0.12)] transition-transform duration-300 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none"
                draggable={false}
              />
            </Link>
          </div>
        </div>

      </Container>
    </Section>
  )
}
