import Image from "next/image";
import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LANDING_PAGE } from "@/lib/marketing/copy";

export function LandingHowItWorksSection() {
  const copy = LANDING_PAGE.howItWorks;

  return (
    <Section spacing="marketing" className="overflow-hidden bg-background">
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <LandingSectionHeader
            align="left"
            label={copy.label}
            headline={copy.headlineDisplay}
            accentPeriod={copy.headlineAccentPeriod}
            subhead={copy.subhead}
            size="lg"
            className="max-w-2xl"
          />
        </RevealOnView>

        <div className="mt-12 grid items-center gap-10 lg:mt-14 lg:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)] lg:gap-10 xl:gap-16">
          <ol className="relative space-y-8 before:absolute before:bottom-5 before:left-[1.35rem] before:top-5 before:w-px before:bg-border/70 sm:space-y-9">
            {copy.steps.map((step) => (
              <li
                key={step.step}
                className="relative grid grid-cols-[2.75rem_1fr] gap-4"
              >
                <span className="relative z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-background font-mono text-xs font-semibold text-brand shadow-[var(--shadow-glass-subtle)]">
                  {step.step}
                </span>
                <RevealOnView>
                  <h3 className="font-display text-xl font-semibold leading-heading tracking-heading text-foreground text-balance sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
                    {step.body}
                  </p>
                </RevealOnView>
              </li>
            ))}
          </ol>

          <RevealOnView className="relative min-h-[15rem] sm:min-h-[21rem] lg:min-h-[25rem]">
            <Image
              src="/marketing/visuals/how-it-works-workflow-v4.webp"
              alt="A live product becomes an evidence-backed Flag and then a verified update review"
              fill
              sizes="(min-width: 1280px) 720px, (min-width: 1024px) 58vw, 100vw"
              className="object-contain object-center drop-shadow-[0_24px_40px_hsl(var(--foreground)/0.08)]"
              unoptimized
            />
          </RevealOnView>
        </div>
      </Container>
    </Section>
  );
}
