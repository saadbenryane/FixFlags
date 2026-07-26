import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/typography'
import { formatUsd, sumEstimatedCostByPlan, sumRevenueByPlan } from '@/lib/billing/costs'

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Free',
  BUILDER: 'Pro',
  TEAM: 'Agency',
}

export async function MarginPanel() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)

  const [costByPlan, revenueByPlan] = await Promise.all([
    sumEstimatedCostByPlan(weekAgo),
    sumRevenueByPlan(weekAgo),
  ])

  const plans = ['FREE', 'BUILDER', 'TEAM'] as const

  return (
    <section className="space-y-4">
      <SectionTitle>Profit & Loss (7 days)</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const cost = costByPlan[plan]
          const rev = revenueByPlan[plan]
          const totalRevenue = rev.total
          const profit = totalRevenue - cost
          const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0
          const healthy = margin >= 70 || plan === 'FREE'

          return (
            <Card key={plan} variant="subtle" className={`${!healthy ? 'ring-2 ring-destructive/50' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{PLAN_LABELS[plan]}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-mono tabular-nums">{formatUsd(totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Run cost (est.)</span>
                  <span className="font-mono tabular-nums">{formatUsd(cost)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-medium">
                  <span>Margin</span>
                  <span className={`font-mono tabular-nums ${!healthy ? 'text-destructive' : ''}`}>
                    {margin.toFixed(1)}%
                  </span>
                </div>
                {!healthy && (
                  <p className="text-xs text-destructive pt-1">
                    Revenue does not cover estimated run costs. Margin is below 70%.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
