import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { HowItWorksSampleLink } from "@/components/marketing/landing/SampleFunnelEvents";
import { LANDING_PAGE } from "@/lib/marketing/copy";

type LoopStep = (typeof LANDING_PAGE.howItWorks.steps)[number];

function StepCard({ step }: { step: LoopStep }) {
  return (
    <article className="flex min-w-0 flex-col">
      <p className="font-mono text-sm font-semibold tabular-nums text-brand">
        {String(step.step).padStart(2, "0")}
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-heading text-foreground sm:text-xl">
        {step.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty sm:text-[0.9375rem]">
        {step.body}
      </p>
      <div className="relative mt-6 flex flex-1 items-end justify-center sm:mt-8">
        <Image
          src={step.image}
          alt=""
          width={step.imageWidth}
          height={step.imageHeight}
          sizes="(min-width: 1024px) 280px, (min-width: 768px) 30vw, 80vw"
          loading="lazy"
          unoptimized
          className="h-auto w-full max-w-[17.5rem] object-contain drop-shadow-sm"
        />
      </div>
    </article>
  );
}

interface HowItWorksLoopSectionProps {
  sampleHref?: string;
}

export function HowItWorksLoopSection({
  sampleHref = "/samples",
}: HowItWorksLoopSectionProps) {
  const {
    label,
    headlineDisplay,
    headlineAccentPeriod,
    subhead,
    sampleLink,
    steps,
  } = LANDING_PAGE.howItWorks;

  return (
    <Section
      spacing="marketing"
      id="how-it-works"
      className="relative scroll-mt-[var(--header-offset)] overflow-hidden"
    >
      <Container
        variant="marketing"
        className="relative space-y-10 px-4 sm:space-y-12 sm:px-6 lg:space-y-14 lg:px-12"
      >
        <LandingSectionHeader
          label={label}
          brandEyebrow
          headline={headlineDisplay}
          accentPeriod={headlineAccentPeriod}
          subhead={subhead}
        />

        <RevealOnView>
          <div className="grid gap-10 sm:gap-12 md:grid-cols-3 md:gap-6 lg:gap-8">
            {steps.map((step, index) => (
              <div key={step.title} className="relative min-w-0">
                <StepCard step={step} />
                {index < steps.length - 1 ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-3 top-[58%] hidden -translate-y-1/2 md:block lg:-right-4"
                  >
                    <ArrowRight
                      className="h-5 w-5 text-foreground/65"
                      strokeWidth={1.5}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </RevealOnView>

        <div className="flex justify-center">
          <HowItWorksSampleLink href={sampleHref} label={sampleLink} />
        </div>
      </Container>
    </Section>
  );
}
