import Image from "next/image";
import {
  Check,
  Crosshair,
  Gem,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { EditorToolMarks } from "@/components/marketing/landing/EditorToolMarks";
import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LANDING_PAGE } from "@/lib/marketing/copy";

const INPUT_ICONS = {
  target: Crosshair,
  shield: ShieldCheck,
  wrench: Wrench,
  refresh: RefreshCw,
} as const;

const OUTPUT_ICONS = {
  check: Check,
  trend: TrendingUp,
  diamond: Gem,
} as const;

export function EditorIntegrationsSection() {
  const copy = LANDING_PAGE.editorIntegrations;

  return (
    <Section
      spacing="marketing"
      tint="subtle"
      id="integrations"
      className="scroll-mt-[var(--header-offset)]"
    >
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <div className="overflow-hidden rounded-card bg-background p-6 shadow-card sm:p-8 lg:p-10">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
              <div className="space-y-6">
                <LandingSectionHeader
                  align="left"
                  label={copy.label}
                  brandEyebrow
                  headline={copy.headlineDisplay}
                  accentPeriod={copy.headlineAccentPeriod}
                  subhead={copy.body}
                  size="sm"
                  className="max-w-md"
                />

                <EditorToolMarks
                  showLabel={false}
                  className="[&_ul]:gap-2.5 [&_li]:rounded-full [&_li]:border [&_li]:border-border/60 [&_li]:bg-muted/40 [&_li]:px-3 [&_li]:py-2 [&_li]:text-xs [&_li]:font-medium [&_li]:text-foreground/80 [&_svg]:h-4 [&_svg]:w-4"
                />

                <p className="text-xs text-muted-foreground">
                  {copy.moreComing}
                </p>
              </div>

              <WorkflowDiagram />
            </div>
          </div>
        </RevealOnView>
      </Container>
    </Section>
  );
}

function WorkflowDiagram() {
  const { inputs, outputs } = LANDING_PAGE.editorIntegrations.workflow;

  return (
    <div
      aria-hidden
      className="relative mx-auto flex w-full max-w-lg flex-col items-center gap-5 sm:gap-6 md:flex-row md:items-center md:justify-center md:gap-5"
    >
      <ul className="flex w-full flex-row flex-wrap justify-center gap-2 md:w-auto md:flex-col md:flex-nowrap md:gap-2.5">
        {inputs.map((item) => {
          const Icon = INPUT_ICONS[item.icon];
          return (
            <li
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-2 text-xs font-medium shadow-sm"
            >
              <Icon className="h-3.5 w-3.5 text-brand" strokeWidth={1.75} />
              {item.title}
            </li>
          );
        })}
      </ul>

      <div className="relative flex flex-col items-center">
        <Image
          src="/marketing/visuals/pricing-glass-mark.webp"
          alt=""
          width={1448}
          height={1086}
          sizes="(min-width: 768px) 15rem, 13rem"
          className="h-auto w-52 select-none object-contain mix-blend-multiply sm:w-60"
          loading="lazy"
          draggable={false}
        />
      </div>

      <ul className="flex w-full flex-row flex-wrap justify-center gap-2 md:w-auto md:flex-col md:flex-nowrap md:gap-2.5">
        {outputs.map((item) => {
          const Icon = OUTPUT_ICONS[item.icon];
          return (
            <li
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-2 text-xs font-medium shadow-sm"
            >
              <Icon className="h-3.5 w-3.5 text-brand" strokeWidth={1.75} />
              <span className="flex-1">{item.title}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
