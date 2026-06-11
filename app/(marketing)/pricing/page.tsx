import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PricingCTAButton } from '@/components/pricing/PricingCTAButton'
import { FaqSection } from '@/components/marketing/FaqSection'
import { CheckCircle2 } from 'lucide-react'
import { PLANS, PRICING, PRICING_FAQ } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('pricing', '/pricing')

export default async function PricingPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  let currentPlan = 'FREE'
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    })
    currentPlan = user?.plan ?? 'FREE'
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">{PRICING.headline}</h1>
          <p className="text-muted-foreground text-lg">{PRICING.subhead}</p>
          <div className="inline-block rounded-full bg-primary/10 text-primary text-sm font-medium px-4 py-1.5">
            {PRICING.foundingBadge}
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
                    <p className="text-xs text-muted-foreground mt-1">{plan.persona}</p>
                    <p className="text-sm font-medium mt-1">{plan.outcome}</p>
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
                <CardDescription className="text-xs font-medium mt-1">{plan.audits}</CardDescription>
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
                <PricingCTAButton
                  plan={plan.plan}
                  cta={plan.cta}
                  signUpHref={plan.href}
                  highlight={plan.highlight}
                  isLoggedIn={!!session}
                  currentPlan={currentPlan}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground">{PRICING.allPlansInclude}</p>

        <div className="text-center border rounded-xl p-8 space-y-4">
          <h3 className="text-xl font-semibold">{PRICING.expertReview.title}</h3>
          <p className="text-muted-foreground">{PRICING.expertReview.body}</p>
          <ol className="text-sm text-muted-foreground space-y-2 max-w-md mx-auto text-left list-decimal list-inside">
            {PRICING.expertReview.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <Button variant="outline" asChild>
            <Link href={session ? '/dashboard' : '/sign-up'}>{PRICING.expertReview.cta}</Link>
          </Button>
        </div>

        <div className="max-w-2xl mx-auto">
          <FaqSection items={PRICING_FAQ} title="Pricing questions" />
        </div>
    </div>
  )
}
