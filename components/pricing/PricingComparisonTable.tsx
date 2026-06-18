import { PLAN_DEFINITIONS } from '@/lib/billing/plans'

const ROWS = [
  {
    feature: "Who it's for",
    free: PLAN_DEFINITIONS.FREE.persona,
    pro: PLAN_DEFINITIONS.BUILDER.persona,
    agency: PLAN_DEFINITIONS.TEAM.persona,
  },
  {
    feature: 'What you get',
    free: 'Full report + fix prompts on every check',
    pro: 'Before/after compare + MCP in your editor',
    agency: 'Public share links + proof exports + up to 5 projects',
  },
  {
    feature: 'Re-checks',
    free: 'Unlimited on reports you own',
    pro: 'Unlimited (no quota)',
    agency: 'Unlimited (no quota)',
  },
  {
    feature: 'Limits',
    free: PLAN_DEFINITIONS.FREE.auditLimitLabel,
    pro: PLAN_DEFINITIONS.BUILDER.auditLimitLabel,
    agency: PLAN_DEFINITIONS.TEAM.auditLimitLabel,
  },
] as const

export function PricingComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-card bg-card shadow-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border/20">
            <th className="p-4 text-left font-medium text-muted-foreground" scope="col" />
            <th className="p-4 text-center font-medium" scope="col">
              Free
            </th>
            <th className="p-4 text-center font-semibold text-brand" scope="col">
              Pro
            </th>
            <th className="p-4 text-center font-medium" scope="col">
              Agency
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.feature} className="border-t border-border/20">
              <td className="p-4 font-medium">{row.feature}</td>
              <td className="p-4 text-center text-muted-foreground">{row.free}</td>
              <td className="p-4 text-center">{row.pro}</td>
              <td className="p-4 text-center text-muted-foreground">{row.agency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
