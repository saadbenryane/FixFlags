import { PLANS } from "@/lib/marketing/copy";
import { cn } from "@/lib/utils";

const FREE = PLANS.find((plan) => plan.plan === "FREE")!;
const PRO = PLANS.find((plan) => plan.plan === "BUILDER")!;
const STUDIO = PLANS.find((plan) => plan.plan === "TEAM")!;

const ROWS = [
  {
    feature: "Who it's for",
    free: FREE.persona,
    pro: PRO.persona,
    studio: STUDIO.persona,
  },
  {
    feature: "Paths",
    free: "1 or 2 auto purchase paths",
    pro: "Extra paths on the waitlist",
    studio: "Multiple stores on the waitlist",
  },
  {
    feature: "Walk",
    free: "About every 6 hours, mobile",
    pro: "Faster cadence on the waitlist",
    studio: "Same walk as Free",
  },
  {
    feature: "Proof",
    free: "Video, GIF fallback, screenshots",
    pro: "Longer video history on the waitlist",
    studio: "Same proof as Free",
  },
  {
    feature: "Alerts",
    free: "Email on confirmed Can't buy and recovery. Optional Slack.",
    pro: "Same alerts",
    studio: "Shared alert destination later",
  },
  {
    feature: "Recheck",
    free: "5 per day",
    pro: "Higher cap on the waitlist",
    studio: "5 per day until extras open",
  },
  {
    feature: "Funnel numbers",
    free: "Steps from our walk. No invented %.",
    pro: "Real Shopify data when approved",
    studio: "Waitlist",
  },
] as const;

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
              "overflow-hidden rounded-card bg-card shadow-card",
              highlight && "ring-1 ring-brand/25",
            )}
          >
            <div
              className={cn(
                "flex items-end justify-between gap-4 p-4",
                highlight && "bg-brand/[0.045]",
              )}
            >
              <h3 id={`comparison-${key}`} className="font-semibold">
                {name}
              </h3>
              <p className="font-mono text-sm font-semibold tabular-nums">{price}</p>
            </div>
            <dl className="divide-y divide-border/30">
              {ROWS.map((row) => (
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

      <div className="hidden overflow-hidden rounded-card bg-card shadow-card md:block">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-border/30">
              <th
                className="w-[22%] p-5 text-left text-xs font-medium uppercase tracking-label text-muted-foreground"
                scope="col"
              >
                What is included
              </th>
              {COLUMNS.map(({ key, name, price, highlight }) => (
                <th
                  key={key}
                  className={cn("p-5 text-center", highlight && "bg-brand/[0.04]")}
                  scope="col"
                >
                  <span
                    className={cn(
                      "block font-semibold",
                      highlight && "marketing-accent-text",
                    )}
                  >
                    {name}
                  </span>
                  <span className="mt-1 block font-mono text-xs font-normal tabular-nums text-muted-foreground">
                    {price}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
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
