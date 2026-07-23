import { AuditInput } from '@/components/audit/AuditInput'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { HERO } from '@/lib/marketing/copy'

export function LandingHeroSection() {
  return (
    <Section spacing="marketing" className="pb-6 sm:pb-8 lg:pb-10">
      <Container className="relative">
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
          <h1 className="max-w-[24ch] text-balance font-serif text-4xl font-medium leading-display tracking-display motion-safe:animate-fade-in-up motion-safe:[animation-delay:40ms] motion-safe:[animation-fill-mode:both] sm:text-5xl lg:text-6xl">
            <span>
              <span className="text-brand">{HERO.headlineAccent}</span>{' '}
              {HERO.headlineLine1}
            </span>
            <br className="hidden sm:block" />
            <span className="sm:hidden" aria-hidden>{' '}</span>
            <span className="text-brand">{HERO.headlineLine2}</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground motion-safe:animate-fade-in-up motion-safe:[animation-delay:80ms] motion-safe:[animation-fill-mode:both] sm:text-lg">
            {HERO.subhead}
          </p>

          <div
            id="audit"
            className="mt-8 w-full max-w-2xl scroll-mt-[calc(var(--header-offset)+1rem)] motion-safe:animate-fade-in-up motion-safe:[animation-delay:160ms] motion-safe:[animation-fill-mode:both]"
          >
            <AuditInput variant="landing" idSuffix="-hero" ctaPlacement="hero" />
          </div>

          <div className="mt-8 w-full max-w-2xl motion-safe:animate-fade-in-up motion-safe:[animation-delay:200ms] motion-safe:[animation-fill-mode:both]">
            <EditorToolMarks compact showLabel className="items-center [&_ul]:justify-center" />
          </div>
        </div>
      </Container>
    </Section>
  )
}
