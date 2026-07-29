import { AuditInput } from "@/components/audit/AuditInput";
import { AssuranceRow } from "@/components/marketing/landing/AssuranceRow";
import { EditorToolMarks } from "@/components/marketing/landing/EditorToolMarks";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/typography";
import { HERO } from "@/lib/marketing/copy";

export function LandingHeroSection() {
  return (
    <Section
      spacing="hero"
      className="relative flex min-h-0 flex-col overflow-x-clip !pb-10 !pt-7 sm:!pb-12 sm:!pt-10 lg:!pb-14 lg:!pt-10"
    >
      <Container
        variant="marketing"
        className="flex w-full flex-col px-4 sm:px-6 lg:px-12"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 text-center sm:gap-5 lg:pt-1">
          <p className="inline-flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-brand sm:text-xs">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
              aria-hidden
            />
            {HERO.badge}
          </p>

          <div className="space-y-5 sm:space-y-6 lg:mt-2.5 lg:space-y-4">
            <Heading
              as="h1"
              className="mx-auto max-w-[14ch] font-display text-[2.75rem] font-bold leading-[1.08] tracking-display [text-rendering:geometricPrecision] sm:text-[3.125rem] sm:leading-[1.08] lg:text-[4rem] lg:leading-none xl:text-[4.125rem]"
            >
              {HERO.headlineDisplay}
              {HERO.headlineAccentPeriod ? (
                <span className="text-brand" aria-hidden>
                  .
                </span>
              ) : null}
            </Heading>
            <p className="mx-auto max-w-[42ch] text-[0.9375rem] leading-relaxed text-muted-foreground/95 text-pretty sm:max-w-xl sm:text-base lg:max-w-[34rem] lg:text-base lg:leading-relaxed">
              {HERO.subhead}
            </p>
          </div>

          <div
            id="audit"
            className="w-full max-w-2xl scroll-mt-[calc(var(--header-offset)+1rem)] pt-1"
          >
            <AuditInput
              variant="landing"
              idSuffix="-hero"
              ctaPlacement="hero"
              showLandingExtras={false}
            />
          </div>

          <AssuranceRow className="items-center sm:justify-center" />

          <EditorToolMarks
            variant="hero"
            showLabel
            label={HERO.trustLine}
            className="mt-3 text-center [&_ul]:justify-center sm:mt-4 lg:mt-6"
          />
        </div>
      </Container>
    </Section>
  );
}
