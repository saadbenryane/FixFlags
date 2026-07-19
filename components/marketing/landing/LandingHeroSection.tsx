import { AuditInput } from '@/components/audit/AuditInput'
import { BrandIllustration } from '@/components/marketing/landing/BrandIllustration'
import { EditorToolMarks } from '@/components/marketing/landing/EditorToolMarks'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { HERO } from '@/lib/marketing/copy'

export function LandingHeroSection() {
  return (
    <Section spacing="marketing" className="pb-10 sm:pb-14 lg:pb-16">
      <Container className="relative">
        <BrandIllustration
          veil="soft"
          sizes="(min-width: 1024px) 420px, 0px"
          className="absolute left-[52%] top-[-5rem] z-0 hidden h-[32rem] w-[22rem] -translate-x-1/2 opacity-[0.38] [mask-image:radial-gradient(ellipse_82%_86%_at_50%_46%,black_14%,transparent_70%)] lg:block dark:hidden xl:left-[54%] xl:top-[-6rem] xl:h-[36rem] xl:w-[26rem]"
          imageClassName="scale-[1.12] object-[50%_50%]"
        />

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
          <h1 className="max-w-[20ch] text-balance font-serif text-4xl font-medium leading-display tracking-display motion-safe:animate-fade-in-up motion-safe:[animation-delay:40ms] motion-safe:[animation-fill-mode:both] sm:text-5xl lg:text-6xl">
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
            <AuditInput variant="landing" idSuffix="-hero" ctaPlacement="hero" />
          </div>
        </div>

        <EditorToolMarks
          compact
          className="relative z-10 mx-auto mt-11 max-w-4xl items-center text-center sm:mt-14 [&_ul]:justify-center"
        />
      </Container>
    </Section>
  )
}
