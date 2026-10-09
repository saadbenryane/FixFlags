import { LandingSectionHeader } from "@/components/marketing/landing/LandingSectionHeader";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SITE_COMPARE } from "@/lib/marketing/copy";
import { ArrowUpRight, Check, X } from "lucide-react";

type ColumnId = (typeof SITE_COMPARE.columns)[number]["id"];

type CompareValue = (typeof SITE_COMPARE.rows)[number]["values"][ColumnId];

function CompareMark({
  product,
  capability,
  value,
}: {
  product: string;
  capability: string;
  value: CompareValue;
}) {
  const qualifier = "qualifier" in value ? value.qualifier : undefined;
  const accessible = value.supported
    ? `${product}: ${capability} supported${qualifier ? `, ${qualifier}` : ""}`
    : `${product}: ${capability} not included`;

  return (
    <span className="inline-grid justify-items-center gap-1 text-center" aria-label={accessible}>
      {value.supported ? (
        <Check className="h-[18px] w-[18px] text-success" strokeWidth={2.25} aria-hidden="true" />
      ) : (
        <X className="h-[18px] w-[18px] text-muted-foreground/65" strokeWidth={1.8} aria-hidden="true" />
      )}
      {qualifier ? <small className="max-w-16 text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">{qualifier}</small> : null}
    </span>
  );
}

function CompareRows() {
  const copy = SITE_COMPARE;

  return (
    <div className="overflow-hidden rounded-card border border-border/60 bg-background/80 shadow-card">
      <table className="w-full table-fixed border-collapse text-left" aria-label={copy.mobileLabel}>
        <caption className="sr-only">{copy.headline}</caption>
        <colgroup>
          <col className="w-[42%] sm:w-[36%]" />
          {copy.columns.map(column => <col key={column.id} className="w-[14.5%] sm:w-[16%]" />)}
        </colgroup>
        <thead>
          <tr className="border-b border-border/60">
            <th scope="col" className="px-3 py-3 text-[10px] font-medium text-muted-foreground sm:px-5 sm:py-4 sm:text-xs">
              {copy.capabilityLabel}
            </th>
            {copy.columns.map((col) => (
              <th key={col.id} scope="col" className="px-1 py-2 text-center text-[10px] font-semibold leading-tight tracking-heading text-foreground sm:px-3 sm:py-4 sm:text-xs lg:text-sm">
                <a href={col.source} aria-label={col.label} target={col.source.startsWith("http") ? "_blank" : undefined} rel={col.source.startsWith("http") ? "noopener noreferrer" : undefined} className="inline-flex min-h-11 items-center justify-center gap-1 hover:text-brand hover:underline">
                  <span className="sm:hidden">{col.shortLabel}</span>
                  <span className="hidden sm:inline">{col.label}</span>
                  <ArrowUpRight className="hidden h-3 w-3 lg:block" aria-hidden="true" />
                </a>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {copy.rows.map((row) => (
            <tr key={row.id} className="border-b border-border/50 last:border-b-0">
              <th scope="row" className="px-3 py-3 text-left align-middle text-[11px] font-medium leading-snug text-foreground text-pretty sm:px-5 sm:py-4 sm:text-sm">
                {row.capability}
              </th>
              {copy.columns.map((col) => (
                <td key={col.id} className="px-1 py-3 text-center align-middle sm:px-3 sm:py-4">
                  <CompareMark product={col.label} capability={row.capability} value={row.values[col.id as ColumnId]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareBody() {
  const copy = SITE_COMPARE;

  return (
    <>
      <LandingSectionHeader
        align="left"
        label={copy.label}
        headline={copy.headlineDisplay}
        accentPeriod={copy.headlineAccentPeriod}
        size="lg"
        className="max-w-2xl"
      />

      <div className="mt-8 sm:mt-10">
        <CompareRows />
      </div>

      <p className="mt-5 max-w-2xl text-xs leading-relaxed text-muted-foreground text-pretty sm:text-sm">
        {copy.subline} {copy.legend}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{copy.sourceNote}</p>
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
