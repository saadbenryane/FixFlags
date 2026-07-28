"use client";

import Link from "next/link";
import {
  useCallback,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Crosshair,
  Info,
  LayoutGrid,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { CheckDimensionsScene } from "@/components/marketing/landing/CheckDimensionsScene";
import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { rubricIcon } from "@/lib/rubric-icons";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LANDING_PAGE } from "@/lib/marketing/copy";
import { cn } from "@/lib/utils";

type DimensionId = (typeof LANDING_PAGE.checkDimensions.cards)[number]["id"];
type TabId = DimensionId | "all";

const VALUE_ICONS = {
  shield: ShieldCheck,
  target: Crosshair,
  zap: Zap,
  refresh: RefreshCw,
} as const;

const SEVERITY_TONE: Record<string, string> = {
  High: "bg-destructive/10 text-destructive",
  Medium: "bg-brand/10 text-brand",
  Good: "bg-success/10 text-success",
};

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "High") {
    return (
      <AlertTriangle
        className="h-3.5 w-3.5 text-destructive"
        strokeWidth={2}
        aria-hidden
      />
    );
  }
  if (severity === "Good") {
    return (
      <CheckCircle2
        className="h-3.5 w-3.5 text-success"
        strokeWidth={2}
        aria-hidden
      />
    );
  }
  return (
    <Info className="h-3.5 w-3.5 text-brand" strokeWidth={2} aria-hidden />
  );
}

function ValuePedestal({
  icon: Icon,
}: {
  icon: (typeof VALUE_ICONS)[keyof typeof VALUE_ICONS];
}) {
  return (
    <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center">
      {/* Soft pedestal shadow using CSS only, with no white-fringe raster */}
      <span
        aria-hidden
        className="absolute bottom-0.5 h-3 w-10 rounded-full bg-foreground/10 blur-[6px]"
      />
      <span
        aria-hidden
        className="absolute bottom-1 h-2.5 w-9 rounded-full bg-background shadow-[0_1px_2px_hsl(240_8%_5%/0.08),inset_0_1px_0_hsl(0_0%_100%/0.9)]"
      />
      <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-background text-brand shadow-[0_6px_16px_-8px_hsl(240_8%_5%/0.28),inset_0_1px_0_hsl(0_0%_100%/0.95)]">
        <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} aria-hidden />
      </span>
    </span>
  );
}

export function CheckDimensionsSection() {
  const copy = LANDING_PAGE.checkDimensions;
  const baseId = useId();
  const tabIds: TabId[] = [...copy.cards.map((c) => c.id), "all"];
  const [tab, setTab] = useState<TabId>("message");
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const activeCard =
    tab === "all"
      ? copy.allChecks
      : (copy.cards.find((card) => card.id === tab) ?? copy.cards[0]!);

  const selectTab = useCallback((next: TabId) => {
    setTab(next);
    tabRefs.current[next]?.focus();
  }, []);

  const onTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    current: TabId,
  ) => {
    const index = tabIds.indexOf(current);
    if (index < 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = tabIds[(index + delta + tabIds.length) % tabIds.length]!;
      selectTab(next);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectTab(tabIds[0]!);
    } else if (event.key === "End") {
      event.preventDefault();
      selectTab(tabIds[tabIds.length - 1]!);
    }
  };

  const panelId = `${baseId}-panel`;
  const tabButtonId = (id: TabId) => `${baseId}-tab-${id}`;

  return (
    <Section
      spacing="compact"
      tint="subtle"
      id="what-it-checks"
      className="scroll-mt-[var(--header-offset)] py-5 sm:py-6 lg:py-6"
    >
      <Container
        variant="marketing"
        className="space-y-4 px-4 sm:space-y-4 sm:px-6 lg:space-y-4 lg:px-12"
      >
        <LandingSectionHeader
          label={copy.label}
          brandEyebrow
          headline={copy.headlineDisplay}
          accentPeriod={copy.headlineAccentPeriod}
          subhead={copy.subhead}
          size="lg"
          className="max-w-xl !space-y-2.5 [&_p:last-child]:max-w-[38rem] [&_p:last-child]:text-[0.875rem] [&_p:last-child]:leading-relaxed"
        />

        <div
          role="tablist"
          aria-label="Release readiness dimensions"
          className="mx-auto flex w-full max-w-[34rem] justify-between gap-0 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {copy.cards.map((card) => {
            const Icon = rubricIcon(card.icon);
            const selected = tab === card.id;
            return (
              <button
                key={card.id}
                ref={(el) => {
                  tabRefs.current[card.id] = el;
                }}
                type="button"
                role="tab"
                id={tabButtonId(card.id)}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(card.id)}
                onKeyDown={(e) => onTabKeyDown(e, card.id)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 sm:px-4 sm:text-sm",
                  selected
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                {card.title}
              </button>
            );
          })}
          <button
            ref={(el) => {
              tabRefs.current.all = el;
            }}
            type="button"
            role="tab"
            id={tabButtonId("all")}
            aria-label={copy.allChecksTab}
            aria-selected={tab === "all"}
            aria-controls={panelId}
            tabIndex={tab === "all" ? 0 : -1}
            onClick={() => setTab("all")}
            onKeyDown={(e) => onTabKeyDown(e, "all")}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 sm:px-4 sm:text-sm",
              tab === "all"
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            <span className="sm:hidden">All</span>
            <span className="hidden sm:inline">{copy.allChecksTab}</span>
          </button>
        </div>

        <RevealOnView>
          <div role="tabpanel" id={panelId} aria-labelledby={tabButtonId(tab)}>
            <div className="mx-auto grid max-w-[72rem] items-start gap-6 lg:grid-cols-[minmax(0,0.74fr)_minmax(18rem,1.15fr)_minmax(0,0.9fr)] lg:gap-6 xl:gap-7">
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-background text-brand shadow-card">
                    {(() => {
                      const Icon =
                        activeCard.icon === "all"
                          ? LayoutGrid
                          : rubricIcon(activeCard.icon);
                      return (
                        <Icon
                          className="h-4 w-4"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      );
                    })()}
                  </span>
                  <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-label text-brand">
                    {activeCard.label}
                  </p>
                </div>
                <h3 className="text-xl font-semibold tracking-heading sm:text-[1.35rem]">
                  {activeCard.panelTitle}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  {activeCard.panelBody}
                </p>
                <ul className="space-y-1.5">
                  {activeCard.checks.map((check) => (
                    <li
                      key={check}
                      className="flex items-start gap-2.5 text-sm text-foreground"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                        aria-hidden
                      />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <CheckDimensionsScene className="max-w-[18rem] lg:pt-1" />

              <div className="rounded-[1.15rem] bg-background p-4 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold">
                    {copy.topIssuesTitle}
                  </h4>
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold tabular-nums text-foreground">
                    {activeCard.topIssues.length}
                  </span>
                </div>
                <ul className="mt-2.5 space-y-0">
                  {activeCard.topIssues.map((issue) => (
                    <li
                      key={issue.title}
                      className="border-b border-border/50 py-1.5 first:pt-0 last:border-0 last:pb-0"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
                          <SeverityIcon severity={issue.severity} />
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[0.8125rem] font-medium text-foreground text-pretty">
                              {issue.title}
                            </p>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold",
                                SEVERITY_TONE[issue.severity] ??
                                  "bg-muted text-muted-foreground",
                              )}
                            >
                              {issue.severity}
                            </span>
                          </div>
                          <div className="flex items-end gap-2">
                            <p className="min-w-0 flex-1 text-[0.6875rem] leading-relaxed text-muted-foreground text-pretty">
                              {issue.body}
                            </p>
                            <Link
                              href={issue.categoryHref}
                              className="relative inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground before:absolute before:-inset-x-2 before:-inset-y-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
                            >
                              /{issue.category}
                              <ArrowRight className="h-3 w-3" aria-hidden />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link
                  href={copy.viewAllIssuesHref}
                  className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-foreground hover:text-brand"
                >
                  {copy.viewAllIssues}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </RevealOnView>

        <ul className="grid gap-0 overflow-hidden rounded-card bg-background/70 shadow-card sm:grid-cols-2 lg:grid-cols-4">
          {copy.values.map((item, index) => {
            const Icon = VALUE_ICONS[item.icon];
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-start gap-3 px-5 py-2.5 sm:px-5 sm:py-2.5",
                  index > 0 && "border-t border-border/50 sm:border-t-0",
                  index % 2 === 1 && "sm:border-l sm:border-border/50",
                  index > 0 && "lg:border-l lg:border-border/50",
                  index >= 2 && "sm:border-t sm:border-border/50 lg:border-t-0",
                )}
              >
                <ValuePedestal icon={Icon} />
                <div className="min-w-0 space-y-1 pt-0.5">
                  <p className="text-sm font-semibold text-foreground">
                    {item.title}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                    {item.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
