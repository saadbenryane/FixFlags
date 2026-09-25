import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SITE_COMPARE } from "@/lib/marketing/copy";
import { cn } from "@/lib/utils";

type ColumnId = (typeof SITE_COMPARE.columns)[number]["id"];

function CompareRows() {
  const copy = SITE_COMPARE;

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {copy.rows.map((row) => (
          <article key={row.id} className="rounded-card border border-border/60 bg-background p-4">
            <h3 className="text-sm font-semibold text-foreground text-pretty">{row.question}</h3>
            <dl className="mt-3 grid gap-3">
              {copy.columns.map((col) => {
                const highlight = "highlight" in col && col.highlight;
                return (
                  <div key={col.id} className={cn("rounded-control px-3 py-2", highlight && "bg-brand/[0.06]")}>
                    <dt className={cn("text-xs font-semibold", highlight ? "text-brand" : "text-muted-foreground")}>{col.label}</dt>
                    <dd className="mt-1 text-sm leading-snug text-foreground text-pretty">{row.values[col.id as ColumnId]}</dd>
                  </div>
                );
              })}
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-card border border-border/60 bg-background/80 shadow-card md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{copy.headline}</caption>
          <thead>
            <tr className="border-b border-border/60">
              <th scope="col" className="w-[28%] px-5 py-4 text-xs font-medium uppercase tracking-label text-muted-foreground">
                Question
              </th>
              {copy.columns.map((col) => {
                const highlight = "highlight" in col && col.highlight;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    className={cn(
                      "px-4 py-4 text-left text-sm font-semibold tracking-heading",
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
              <tr key={row.id} className="border-b border-border/50 last:border-b-0">
                <th scope="row" className="px-5 py-4 text-left align-top text-sm font-medium text-foreground text-pretty">
                  {row.question}
                </th>
                {copy.columns.map((col) => {
                  const highlight = "highlight" in col && col.highlight;
                  return (
                    <td
                      key={col.id}
                      className={cn(
                        "px-4 py-4 align-top text-sm leading-snug text-foreground text-pretty",
                        highlight && "bg-brand/[0.04] font-medium",
                      )}
                    >
                      {row.values[col.id as ColumnId]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CompareBody() {
  const copy = SITE_COMPARE;

  return (
    <>
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
        <CompareRows />
      </RevealOnView>

      <RevealOnView>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
          {copy.subline}
        </p>
      </RevealOnView>
    </>
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
