import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export default async function BillingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { stripeCustomerId: true, plan: true },
  })

  if (!user?.stripeCustomerId || user.plan === 'FREE') {
    redirect('/pricing')
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  })

  redirect(portalSession.url)
}
