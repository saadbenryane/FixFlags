import { PLAN_DEFINITIONS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

const ROWS = [
  {
    feature: "Who it's for",
    free: PLAN_DEFINITIONS.FREE.persona,
    pro: PLAN_DEFINITIONS.BUILDER.persona,
    studio: PLAN_DEFINITIONS.TEAM.persona,
  },
  {
    feature: "Products",
    free: PLAN_DEFINITIONS.FREE.projectLimitLabel,
    pro: PLAN_DEFINITIONS.BUILDER.projectLimitLabel,
    studio: PLAN_DEFINITIONS.TEAM.projectLimitLabel,
  },
  {
    feature: "Product reviews",
    free: PLAN_DEFINITIONS.FREE.auditLimitLabel,
    pro: PLAN_DEFINITIONS.BUILDER.auditLimitLabel,
    studio: PLAN_DEFINITIONS.TEAM.auditLimitLabel,
  },
  {
    feature: "How far a review goes",
    free: "This page. Checks every public link.",
    pro: "This page and the pages it links to",
    studio: "This page, linked pages, and one level beyond",
  },
  {
    feature: "Release history",
    free: "Latest changes",
    pro: "Across releases",
    studio: "Shared across the workspace",
  },
  {
    feature: "Scheduled reviews",
    free: "No",
    pro: "No",
    studio: "Yes",
  },
  {
    feature: "Workspace seats",
    free: PLAN_DEFINITIONS.FREE.workspaceSeatsLabel,
    pro: PLAN_DEFINITIONS.BUILDER.workspaceSeatsLabel,
    studio: PLAN_DEFINITIONS.TEAM.workspaceSeatsLabel,
  },
  {
    feature: "Report link",
    free: "Included",
    pro: "Included",
    studio: "Included",
  },
] as const;

const COLUMNS = [
  { key: "free", plan: PLAN_DEFINITIONS.FREE, highlight: false },
  { key: "pro", plan: PLAN_DEFINITIONS.BUILDER, highlight: true },
  { key: "studio", plan: PLAN_DEFINITIONS.TEAM, highlight: false },
] as const;

export function PricingComparisonTable() {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {COLUMNS.map(({ key, plan, highlight }) => (
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
                {plan.name}
              </h3>
              <p className="font-mono text-sm font-semibold tabular-nums">
                {plan.price}
                <span className="font-sans text-xs font-normal text-muted-foreground">
                  {plan.period}
                </span>
              </p>
            </div>
            <dl className="divide-y divide-border/30">
              {ROWS.map((row) => (
                <div
                  key={row.feature}
                  className="grid grid-cols-[7.5rem_1fr] gap-4 px-4 py-3 text-sm"
                >
                  <dt className="font-medium text-muted-foreground">
                    {row.feature}
                  </dt>
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
              {COLUMNS.map(({ key, plan, highlight }) => (
                <th
                  key={key}
                  className={cn(
                    "p-5 text-center",
                    highlight && "bg-brand/[0.04]",
                  )}
                  scope="col"
                >
                  <span
                    className={cn(
                      "block font-semibold",
                      highlight && "marketing-accent-text",
                    )}
                  >
                    {plan.name}
                  </span>
                  <span className="mt-1 block font-mono text-xs font-normal tabular-nums text-muted-foreground">
                    {plan.price}
                    {plan.period}
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
