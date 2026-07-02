import 'server-only'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { sendMetaCapiEvent } from '@/lib/analytics/meta-capi'
import { CLICK_IDS_COOKIE, parseClickIds } from '@/lib/analytics/click-ids'
import { logger } from '@/lib/logger'

/**
 * Server-side signup conversion, fired once from the better-auth
 * user.create.after hook. This is the single source of truth for:
 *  - persisting gclid/fbclid onto the new User (ad -> revenue attribution)
 *  - sending the Meta Conversions API CompleteRegistration event
 *
 * It runs for BOTH email and OAuth signups (the client pixel only fires for
 * email signups on the sign-up page). The eventId is deterministic
 * (`signup_<userId>`) and shared with the client pixel so Meta deduplicates
 * the client + server pair into one conversion.
 *
 * Never throws: signup must not fail or slow down because of analytics.
 */
export async function recordSignupConversion(user: {
  id: string
  email: string
}): Promise<void> {
  try {
    const cookieStore = await cookies()
    const { gclid, fbclid } = parseClickIds(cookieStore.get(CLICK_IDS_COOKIE)?.value)

    if (gclid || fbclid) {
      await prisma.user
        .update({ where: { id: user.id }, data: { gclid, fbclid } })
        .catch((err) => logger.warn('click-id persist failed', { userId: user.id, err }))
    }

    const fbc = cookieStore.get('_fbc')?.value ?? null
    const fbp = cookieStore.get('_fbp')?.value ?? null

    const hdrs = await headers()
    const userAgent = hdrs.get('user-agent')
    const clientIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const eventSourceUrl = hdrs.get('referer') ?? hdrs.get('origin') ?? undefined

    await sendMetaCapiEvent({
      eventName: 'CompleteRegistration',
      email: user.email,
      fbc,
      fbp,
      clientIp,
      userAgent,
      eventId: `signup_${user.id}`,
      eventSourceUrl,
    })
  } catch (err) {
    logger.warn('signup conversion failed', {
      userId: user.id,
      err: err instanceof Error ? err.message : String(err),
    })
  }
}
