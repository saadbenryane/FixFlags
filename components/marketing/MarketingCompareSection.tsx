"use client";

import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SITE_COMPARE } from "@/lib/marketing/copy";
import { cn } from "@/lib/utils";
import { Check, CircleHelp, X } from "lucide-react";

type ColumnId = (typeof SITE_COMPARE.columns)[number]["id"];

function CellMark({ yes, highlight }: { yes: boolean; highlight?: boolean }) {
  if (yes) {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full",
          highlight ? "bg-brand/12 text-brand" : "bg-muted/70 text-foreground",
        )}
        aria-label="Yes"
      >
        <Check className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 text-muted-foreground/70"
      aria-label="No"
    >
      <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
    </span>
  );
}

function QuestionLabel({
  question,
  tooltip,
}: {
  question: string;
  tooltip?: string;
}) {
  if (!tooltip) {
    return (
      <span className="text-sm font-medium text-foreground text-pretty">
        {question}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground text-pretty">
      {question}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label={`About: ${question}`}
          >
            <CircleHelp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-pretty">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function CompareTable() {
  const copy = SITE_COMPARE;

  return (
    <div className="overflow-hidden rounded-card border border-border/60 bg-background/80 shadow-card">
      <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[36rem] border-collapse text-left md:min-w-0">
          <caption className="sr-only">{copy.headline}</caption>
          <thead>
            <tr className="border-b border-border/60">
              <th
                scope="col"
                className="sticky left-0 z-20 bg-background/95 px-4 py-4 text-xs font-medium uppercase tracking-label text-muted-foreground backdrop-blur sm:px-5"
              >
                Question
              </th>
              {copy.columns.map((col) => {
                const highlight = "highlight" in col && col.highlight;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    className={cn(
                      "min-w-[7.5rem] px-3 py-4 text-center text-sm font-semibold tracking-heading sm:min-w-[9rem] sm:px-4",
                      highlight ? "bg-brand/[0.04] text-brand" : "text-foreground",
                    )}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {copy.rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border/50 last:border-b-0"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-background/95 px-4 py-3.5 text-left align-middle font-normal backdrop-blur sm:px-5"
                >
                  <QuestionLabel
                    question={row.question}
                    tooltip={"tooltip" in row ? row.tooltip : undefined}
                  />
                </th>
                {copy.columns.map((col) => {
                  const yes = row.values[col.id as ColumnId];
                  const highlight = "highlight" in col && col.highlight;
                  return (
                    <td
                      key={col.id}
                      className={cn(
                        "px-3 py-3.5 text-center align-middle sm:px-4",
                        highlight && "bg-brand/[0.04]",
                      )}
                    >
                      <div className="flex justify-center">
                        <CellMark yes={yes} highlight={Boolean(highlight)} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border/50 px-4 py-2 text-xs text-muted-foreground md:hidden">
        Swipe sideways to compare all three.
      </p>
    </div>
  );
}

function CompareBody() {
  const copy = SITE_COMPARE;

  return (
    <TooltipProvider delayDuration={120}>
      <RevealOnView>
        <LandingSectionHeader
          align="left"
          label={copy.label}
          headline={copy.headlineDisplay}
          accentPeriod={copy.headlineAccentPeriod}
          size="lg"
          className="max-w-2xl"
        />
      </RevealOnView>

      <RevealOnView className="mt-10">
        <CompareTable />
      </RevealOnView>

      <RevealOnView>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
          {copy.subline}
        </p>
      </RevealOnView>
    </TooltipProvider>
  );
}

export function MarketingCompareSection({
  tint = "none",
  embedded = false,
}: {
  tint?: "none" | "subtle";
  /** When true, skip outer Section/Container (use inside pricing page container). */
  embedded?: boolean;
}) {
  if (embedded) {
    return <CompareBody />;
  }

  return (
    <Section
      spacing="marketing"
      tint={tint === "subtle" ? "subtle" : undefined}
      className="overflow-hidden"
    >
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <CompareBody />
      </Container>
    </Section>
  );
}
