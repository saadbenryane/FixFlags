import { prisma } from '@/lib/db'
import { deleteAuditScreenshotAssets } from '@/lib/storage/screenshots'
import { getStripe } from '@/lib/stripe'

export async function deleteUserProductData(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeSubscriptionId: true, stripeCustomerId: true },
  })

  try {
    if (user?.stripeSubscriptionId) {
      const stripe = getStripe()
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })
    }
  } catch {
    // Stripe may not be configured or sub already cancelled, proceed with cleanup
  }

  const audits = await prisma.audit.findMany({
    where: { userId },
    select: { id: true },
  })
  await deleteAuditScreenshotAssets(audits.map((audit) => audit.id))
  await prisma.$transaction([
    prisma.audit.deleteMany({ where: { userId } }),
    prisma.project.deleteMany({ where: { userId } }),
    prisma.apiKey.deleteMany({ where: { userId } }),
    prisma.emailLog.deleteMany({ where: { userId } }),
  ])
}
