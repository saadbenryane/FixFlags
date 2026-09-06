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
    return <span className="text-sm font-medium text-foreground text-pretty">{question}</span>;
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

          {/* Desktop table */}
          <RevealOnView className="mt-10 hidden md:block">
            <div className="overflow-hidden rounded-card border border-border/60 bg-background/80 shadow-card">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">{copy.headline}</caption>
                <thead>
                  <tr className="border-b border-border/60">
                    <th scope="col" className="px-5 py-4 text-xs font-medium uppercase tracking-label text-muted-foreground">
                      Question
                    </th>
                    {copy.columns.map((col) => (
                      <th
                        key={col.id}
                        scope="col"
                        className={cn(
                          "px-4 py-4 text-center text-sm font-semibold tracking-heading",
                          "highlight" in col && col.highlight
                            ? "bg-brand/[0.04] text-brand"
                            : "text-foreground",
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {copy.rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 last:border-b-0">
                      <th scope="row" className="px-5 py-3.5 align-middle font-normal">
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
                              "px-4 py-3.5 text-center align-middle",
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
          </RevealOnView>

          {/* Mobile cards */}
          <div className="mt-10 grid gap-4 md:hidden">
            {copy.columns.map((col) => {
              const highlight = "highlight" in col && col.highlight;
              return (
                <RevealOnView key={col.id}>
                  <article
                    className={cn(
                      "rounded-card border border-border/60 bg-background/80 p-5 shadow-card",
                      highlight && "ring-1 ring-brand/25",
                    )}
                  >
                    <p
                      className={cn(
                        "font-mono text-xs font-semibold uppercase tracking-label",
                        highlight ? "text-brand" : "text-muted-foreground",
                      )}
                    >
                      {col.label}
                    </p>
                    <ul className="mt-4 space-y-3">
                      {copy.rows.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-start justify-between gap-3"
                        >
                          <QuestionLabel
                            question={row.question}
                            tooltip={"tooltip" in row ? row.tooltip : undefined}
                          />
                          <CellMark
                            yes={row.values[col.id as ColumnId]}
                            highlight={Boolean(highlight)}
                          />
                        </li>
                      ))}
                    </ul>
                  </article>
                </RevealOnView>
              );
            })}
          </div>

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
