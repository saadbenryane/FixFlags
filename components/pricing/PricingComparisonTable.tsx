import { PLANS, PRICING_COMPARISON } from "@/lib/marketing/copy";
import { PlanPrice } from "@/components/pricing/PlanPrice";
import { cn } from "@/lib/utils";

const FREE = PLANS.find((plan) => plan.plan === "FREE")!;
const PRO = PLANS.find((plan) => plan.plan === "BUILDER")!;
const STUDIO = PLANS.find((plan) => plan.plan === "TEAM")!;

const COLUMNS = [
  { key: "free" as const, name: FREE.name, price: FREE.price, highlight: false },
  { key: "pro" as const, name: PRO.name, price: PRO.price, highlight: true },
  { key: "studio" as const, name: STUDIO.name, price: STUDIO.price, highlight: false },
];

export function PricingComparisonTable() {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {COLUMNS.map(({ key, name, price, highlight }) => (
          <section
            key={key}
            aria-labelledby={`comparison-${key}`}
            className={cn(
              "overflow-hidden rounded-[13px] border border-border/65 bg-background",
              highlight && "border-brand",
            )}
          >
            <div className="flex items-end justify-between gap-4 p-4">
              <h3 id={`comparison-${key}`} className="font-display font-semibold">
                {name}
              </h3>
              <PlanPrice price={price} size="sm" className="text-muted-foreground" />
            </div>
            <dl className="divide-y divide-border/30">
              {PRICING_COMPARISON.rows.map((row) => (
                <div
                  key={row.feature}
                  className="grid grid-cols-[7.5rem_1fr] gap-4 px-4 py-3 text-sm"
                >
                  <dt className="font-medium text-muted-foreground">{row.feature}</dt>
                  <dd className="text-right leading-snug">{row[key]}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-[13px] border border-border/65 bg-background md:block">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border/30">
              <th
                className="w-[22%] p-5 text-left text-xs font-semibold text-muted-foreground"
                scope="col"
              >
                {PRICING_COMPARISON.includedLabel}
              </th>
              {COLUMNS.map(({ key, name, price, highlight }) => (
                <th
                  key={key}
                  className={cn("p-5 text-center", highlight && "bg-brand/[0.04]")}
                  scope="col"
                >
                  <span
                    className={cn(
                      "block font-display font-semibold",
                      highlight && "marketing-accent-text",
                    )}
                  >
                    {name}
                  </span>
                  <PlanPrice
                    price={price}
                    size="sm"
                    className="mt-1 block font-normal text-muted-foreground"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRICING_COMPARISON.rows.map((row) => (
              <tr key={row.feature} className="border-t border-border/25">
                <th className="p-5 text-left font-medium" scope="row">
                  {row.feature}
                </th>
                {COLUMNS.map(({ key, highlight }) => (
                  <td
                    key={key}
                    className={cn(
                      "p-5 text-center leading-relaxed text-muted-foreground",
                      highlight && "bg-brand/[0.04] text-foreground",
                    )}
                  >
                    {row[key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
