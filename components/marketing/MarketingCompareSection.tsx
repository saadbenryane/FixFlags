import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { RevealOnView } from "@/components/marketing/landing/RevealOnView";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SITE_COMPARE } from "@/lib/marketing/copy";
import { cn } from "@/lib/utils";

type ColumnId = (typeof SITE_COMPARE.columns)[number]["id"];

/**
 * Phones get a decision aid instead of the table. Each question leads with the
 * FixFlags answer, because that is the decision the reader is making, and keeps
 * the other two tools underneath as one honest comparison line. Nothing scrolls
 * sideways and no column is dropped.
 */
function CompareDecisionAid() {
  const copy = SITE_COMPARE;
  const others = copy.columns.filter((col) => !("highlight" in col && col.highlight));
  const primary = copy.columns.find((col) => "highlight" in col && col.highlight) ?? copy.columns[2];

  return (
    <ul
      className="flex flex-col gap-3 md:hidden"
      aria-label={copy.mobileLabel}
    >
      {copy.rows.map((row) => (
        <li
          key={row.id}
          className="rounded-card border border-border/60 bg-background/80 p-4 shadow-card"
        >
          <p className="text-sm font-medium text-foreground text-pretty">
            {row.question}
          </p>
          <p className="mt-2 text-sm font-semibold leading-snug text-brand text-pretty">
            {row.values[primary.id as ColumnId]}
          </p>
          <dl className="mt-3 flex flex-col gap-1.5 border-t border-border/50 pt-3">
            {others.map((col) => (
              <div key={col.id} className="flex gap-2 text-xs leading-snug">
                <dt className="shrink-0 font-medium text-muted-foreground">
                  {col.label}
                </dt>
                <dd className="text-foreground text-pretty">
                  {row.values[col.id as ColumnId]}
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

function CompareRows() {
  const copy = SITE_COMPARE;

  return (
    <>
      <CompareDecisionAid />
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
