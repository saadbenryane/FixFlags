import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    audits: '3 total',
    features: ['Top 3 findings per area', 'Copyable fix prompts', 'No credit card'],
    cta: 'Get started free',
    href: '/sign-up',
    highlight: false,
  },
  {
    name: 'Builder',
    price: '$49',
    period: '/mo',
    founding: '$29/mo for 3 months',
    audits: '25 / month',
    features: [
      'Full reports — all findings',
      'All area prompts',
      'Re-check after fixes',
      'Audit history',
      'MCP API access',
    ],
    cta: 'Start Builder',
    href: '/sign-up?plan=BUILDER',
    highlight: true,
  },
  {
    name: 'Team',
    price: '$199',
    period: '/mo',
    audits: '100 / month',
    features: [
      'Everything in Builder',
      '5 projects',
      'Before/after comparison',
      'Monitoring with alerts',
      'Priority queue',
    ],
    cta: 'Start Team',
    href: '/sign-up?plan=TEAM',
    highlight: false,
  },
  {
    name: 'Studio',
    price: '$999',
    period: '/mo',
    founding: '$499/mo for 3 months',
    audits: '500 / month',
    features: [
      'Everything in Team',
      '20 projects',
      'Shareable public reports',
      'Agency use',
      'Priority support',
    ],
    cta: 'Start Studio',
    href: '/sign-up?plan=STUDIO',
    highlight: false,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">QualityOS</Link>
        <Link href="/sign-in" className="text-sm font-medium text-primary hover:underline">Sign in</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-16 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Simple pricing</h1>
          <p className="text-muted-foreground text-lg">Start free. Upgrade when you ship more.</p>
          <div className="inline-block rounded-full bg-primary/10 text-primary text-sm font-medium px-4 py-1.5">
            🚀 Founding offer active — lock in launch-week pricing
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={plan.highlight ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{plan.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    {plan.founding && (
                      <div className="mt-1 text-xs text-primary font-medium">{plan.founding}</div>
                    )}
                  </div>
                  {plan.highlight && (
                    <div className="rounded-full bg-primary text-primary-foreground text-xs px-2 py-0.5">
                      Popular
                    </div>
                  )}
                </div>
                <CardDescription className="text-xs font-medium mt-1">
                  {plan.audits}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlight ? 'default' : 'outline'}
                  asChild
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center border rounded-xl p-8 space-y-3">
          <h3 className="text-xl font-semibold">Expert Review — $500</h3>
          <p className="text-muted-foreground">
            A human reviews your audit and writes a prioritized fix plan. Perfect for launch week.
          </p>
          <Button variant="outline" asChild>
            <Link href="/sign-up">Get Expert Review</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
