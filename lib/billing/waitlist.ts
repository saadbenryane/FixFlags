import type { Plan } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  DEFAULT_WAITLIST_CAMPAIGN,
  FOUNDER_OFFER_ID,
} from '@/lib/billing/founder-offers'

export type PaidWaitlistPlan = 'BUILDER' | 'TEAM'

export async function upsertPaidPlanWaitlistEntry(input: {
  userId: string
  plan: PaidWaitlistPlan
  source?: string
  campaign?: string
}) {
  const campaign = input.campaign ?? DEFAULT_WAITLIST_CAMPAIGN
  return prisma.paidPlanWaitlistEntry.upsert({
    where: {
      userId_plan: {
        userId: input.userId,
        plan: input.plan,
      },
    },
    create: {
      userId: input.userId,
      plan: input.plan,
      source: input.source,
      campaign,
      founderOfferId: FOUNDER_OFFER_ID,
    },
    update: {
      source: input.source ?? undefined,
      campaign,
    },
  })
}

export async function markWaitlistInvited(entryId: string) {
  return prisma.paidPlanWaitlistEntry.update({
    where: { id: entryId },
    data: { invitedAt: new Date() },
  })
}

export async function markWaitlistConverted(userId: string, plan: Plan) {
  if (plan !== 'BUILDER' && plan !== 'TEAM') return
  await prisma.paidPlanWaitlistEntry.updateMany({
    where: { userId, plan, convertedAt: null },
    data: { convertedAt: new Date() },
  })
}
