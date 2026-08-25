import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LANDING_PAGE } from "@/lib/marketing/copy";
import { rubricIcon } from "@/lib/rubric-icons";

export function LandingRubricsSection() {
  const copy = LANDING_PAGE.checkDimensions;

  return (
    <Section spacing="marketing" tint="subtle" className="overflow-hidden">
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <LandingSectionHeader
            align="left"
            label={copy.label}
            headline={copy.headlineDisplay}
            accentPeriod={copy.headlineAccentPeriod}
            subhead={copy.subhead}
            size="lg"
            className="max-w-3xl"
          />
        </RevealOnView>

        <div className="mt-12 grid items-center gap-10 lg:mt-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(30rem,1.05fr)] lg:gap-10 xl:gap-16">
          <RevealOnView className="relative min-h-[19rem] sm:min-h-[28rem] lg:min-h-[34rem]">
            <Image
              src="/marketing/visuals/review-rubrics-v4.webp"
              alt="Three product views marked for Message, Experience, and Reach review"
              fill
              sizes="(min-width: 1280px) 600px, (min-width: 1024px) 46vw, 100vw"
              className="object-contain object-center drop-shadow-[0_24px_40px_hsl(var(--foreground)/0.08)]"
              unoptimized
            />
          </RevealOnView>

          <div className="space-y-4 sm:space-y-5">
            {copy.cards.map((rubric) => {
              const Icon = rubricIcon(rubric.icon);
              return (
                <RevealOnView key={rubric.id} className="min-w-0">
                  <article className="grid gap-4 rounded-card bg-background/80 p-5 shadow-card sm:grid-cols-[10rem_1fr] sm:gap-6 sm:p-6">
                    <div>
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] bg-muted/55 text-brand shadow-[var(--shadow-glass-subtle)]">
                        <Icon
                          className="h-5 w-5"
                          strokeWidth={1.7}
                          aria-hidden
                        />
                      </span>
                      <h3 className="mt-3 font-display text-xl font-semibold leading-heading tracking-heading text-foreground">
                        {rubric.title}
                      </h3>
                    </div>
                    <div>
                      <h4 className="font-display text-lg font-semibold leading-heading text-foreground text-balance">
                        {rubric.question}
                      </h4>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                        {rubric.panelBody}
                      </p>
                      <ul
                        className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5"
                        aria-label={`${rubric.title} checks`}
                      >
                        {rubric.checks.map((check) => (
                          <li
                            key={check}
                            className="text-xs leading-relaxed text-foreground/70"
                          >
                            {check}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </RevealOnView>
              );
            })}
          </div>
        </div>
      </Container>
    </Section>
  );
}
import Image from "next/image";
