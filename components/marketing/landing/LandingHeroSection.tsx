import { AuditInput } from '@/components/audit/AuditInput'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { LandingTrustBadges } from '@/components/marketing/landing/LandingTrustBadges'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { HERO } from '@/lib/marketing/copy'

export function LandingHeroSection() {
  return (
    <Section spacing="marketing" className="pb-10 sm:pb-14 lg:pb-16">
      <Container className="relative">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          {HERO.audienceLine ? (
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-[var(--glass-bg)] px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-glass backdrop-blur-md motion-safe:animate-fade-in-up">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
              {HERO.audienceLine}
            </span>
          ) : null}
          <h1 className="max-w-[20ch] text-balance font-serif text-4xl font-medium leading-[1.1] tracking-tight motion-safe:animate-fade-in-up motion-safe:[animation-delay:40ms] motion-safe:[animation-fill-mode:both] sm:text-5xl lg:text-6xl">
            <span className="text-brand">{HERO.headlineAccent}</span>{' '}
            {HERO.headlineLine1}{' '}
            <br className="hidden sm:block" />
            {HERO.headlineLine2}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground motion-safe:animate-fade-in-up motion-safe:[animation-delay:80ms] motion-safe:[animation-fill-mode:both] sm:text-lg">
            {HERO.subhead}
          </p>

          <div
            id="audit"
            className="mt-8 w-full max-w-2xl scroll-mt-[calc(var(--header-offset)+1rem)] motion-safe:animate-fade-in-up motion-safe:[animation-delay:160ms] motion-safe:[animation-fill-mode:both]"
          >
            <AuditInput variant="landing" />
          </div>

          <LandingTrustBadges className="mt-5" />
        </div>

        <EditorToolMarks
          compact
          className="mx-auto mt-11 max-w-4xl items-center text-center sm:mt-14 [&_ul]:justify-center"
        />
      </Container>
    </Section>
  )
}
