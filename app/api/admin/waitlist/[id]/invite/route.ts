import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/email/client'
import { WAITLIST_EMAILS } from '@/lib/email/templates'
import { BRAND, SITE_URL } from '@/lib/marketing/copy'
import {
  generateWaitlistInvite,
  grantBatchAccess,
  grantWaitlistEntryAccess,
  markWaitlistInvited,
  type PaidWaitlistPlan,
} from '@/lib/billing/waitlist'

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <hello@fixflags.com>`

const schema = z.object({
  /** Bulk selection; defaults to the single entry in the path. */
  entryIds: z.array(z.string().min(1)).max(100).optional(),
  /** Batch to assign (1 or 2) and/or to use for generated invites. */
  batch: z.union([z.literal(1), z.literal(2)]).optional(),
  /** Required for a batch-wide grant when no entryIds are given. */
  plan: z.enum(['BUILDER', 'TEAM']).optional(),
  action: z.enum(['invite', 'grant', 'assign_batch']).optional(),
})

const INVITE_BODY = (joinUrl: string, name: string, planLabel: string) =>
  `${WAITLIST_EMAILS.invited(planLabel).html(name)}
  <p style="font-size: 14px; line-height: 1.6;">
    Your batch has been assigned. Use your personal link to unlock checkout:
    <a href="${joinUrl}" style="color: #16a34a;">${joinUrl}</a>
  </p>`

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { batch, plan, action = 'invite' } = parsed.data
    const bulk = parsed.data.entryIds
    const entryIds = bulk ?? [id]

    // Batch-wide grant: release a whole cohort at once (no entryIds, plan+batch).
    if (action === 'grant' && (!bulk || bulk.length === 0)) {
      if (batch == null || !plan) {
        return NextResponse.json(
          { error: 'Batch-wide grant needs a batch and a plan' },
          { status: 400 }
        )
      }
      const granted = await grantBatchAccess(plan, batch)
      return NextResponse.json({ ok: true, action, granted, batch, plan })
    }

    // Assign a batch to the selected rows (no email, no code).
    if (action === 'assign_batch') {
      if (batch == null) {
        return NextResponse.json({ error: 'Select a batch (1 or 2)' }, { status: 400 })
      }
      const result = await prisma.paidPlanWaitlistEntry.updateMany({
        where: { id: { in: entryIds } },
        data: { batch },
      })
      return NextResponse.json({ ok: true, action, updated: result.count, batch })
    }

    const entries = await prisma.paidPlanWaitlistEntry.findMany({
      where: { id: { in: entryIds } },
      include: { user: { select: { email: true, name: true } } },
    })

    // Per-member explicit grant.
    if (action === 'grant') {
      let granted = 0
      for (const entry of entries) {
        if (!entry.accessGrantedAt) {
          await grantWaitlistEntryAccess(entry.id)
          granted++
        }
      }
      return NextResponse.json({ ok: true, action, granted })
    }

    // action 'invite' (default): assign the batch, generate a one-time invite
    // code + share link, and email the member. The code grants access on redeem.
    if (batch != null) {
      await prisma.paidPlanWaitlistEntry.updateMany({
        where: { id: { in: entryIds } },
        data: { batch },
      })
    }

    const invites: Array<{
      entryId: string
      code: string
      joinUrl: string
      emailSent: boolean
      email: string | null
    }> = []
    let emailsSent = 0

    for (const entry of entries) {
      const invitePlan: PaidWaitlistPlan =
        entry.plan === 'TEAM' ? 'TEAM' : 'BUILDER'
      const effectiveBatch = batch ?? entry.batch ?? null
      const invite = await generateWaitlistInvite({
        inviteeEmail: entry.user.email ?? entry.email ?? '',
        plan: invitePlan,
        batch: effectiveBatch,
      })
      await markWaitlistInvited(entry.id)

      const planLabel = entry.plan === 'TEAM' ? 'Studio' : 'Pro'
      const joinUrl = `${SITE_URL}/waitlist/${entry.plan === 'TEAM' ? 'studio' : 'pro'}?code=${invite.code}`
      const to = entry.user.email ?? entry.email

      let emailSent = false
      if (resend && to) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to,
          subject: WAITLIST_EMAILS.invited(planLabel).subject,
          html: INVITE_BODY(joinUrl, entry.user.name ?? '', planLabel),
        })
        emailSent = true
        emailsSent++
      }

      invites.push({ entryId: entry.id, code: invite.code, joinUrl, emailSent, email: to ?? null })
    }

    return NextResponse.json({ ok: true, action, invites, emailsSent })
  } catch (err) {
    return handleRouteError(err)
  }
}
