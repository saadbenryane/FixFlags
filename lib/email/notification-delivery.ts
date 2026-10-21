import type { Resend } from 'resend'
import { z } from 'zod'

export const NOTIFICATION_REQUEST_TIMEOUT_MS = 20_000
const PROVIDER_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60_000

/** Backoff belongs to each persisted delivery, independent of sweep frequency. */
export function notificationRetryAt(failedAttempt: number, failedAt: Date) {
  return new Date(failedAt.getTime() + Math.min(6 * 60 * 60_000, 5 * 60_000 * 2 ** Math.max(0, failedAttempt - 1)))
}

export const notificationEmailSnapshotSchema = z.object({
  version: z.literal(1), from: z.string().min(1), to: z.string().email(),
  subject: z.string().min(1), html: z.string().min(1), text: z.string().min(1),
  tags: z.array(z.object({ name: z.string(), value: z.string() }).strict()).max(10),
  firstAttemptAt: z.string().datetime({ offset: true }).optional(),
}).strict()

/** Provider keys expire. A stable key cannot make an arbitrarily late replay safe. */
export function assertNotificationReplayWindow(firstAttemptAt: string | undefined, now: Date) {
  const startedAt = firstAttemptAt ? Date.parse(firstAttemptAt) : NaN
  if (!Number.isFinite(startedAt) || startedAt > now.getTime() ||
      now.getTime() + NOTIFICATION_REQUEST_TIMEOUT_MS >= startedAt + PROVIDER_IDEMPOTENCY_WINDOW_MS)
    throw new Error('Provider idempotency window expired or unavailable; delivery acceptance is unconfirmed')
}

/** Legacy records use a conservative earliest possible submission time.
 * This metadata is committed with the claim and never enters the provider body. */
export function prepareNotificationReplay<T extends z.infer<typeof notificationEmailSnapshotSchema>>(
  payload: T, now: Date, earliestPossibleAttempt: Date) {
  const firstAttemptAt = payload.firstAttemptAt ?? earliestPossibleAttempt.toISOString()
  assertNotificationReplayWindow(firstAttemptAt, now)
  return { ...payload, firstAttemptAt }
}

/** Stored ownership and selection metadata never enter the provider request. */
export function notificationEmailBody(payload: z.infer<typeof notificationEmailSnapshotSchema>) {
  return { from: payload.from, to: payload.to, subject: payload.subject, html: payload.html,
    text: payload.text, tags: payload.tags }
}

/** Both monitoring senders abort the physical SDK request before their lease expires. */
export async function sendNotificationEmail(provider: Pick<Resend, 'emails'>,
  message: Parameters<Resend['emails']['send']>[0], idempotencyKey: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('Notification provider deadline')), NOTIFICATION_REQUEST_TIMEOUT_MS)
  try {
    // The installed SDK forwards these fetch options, including the signal.
    const options = { idempotencyKey, signal: controller.signal }
    const { data, error } = await provider.emails.send(message, options)
    if (error) throw new Error(error.message)
    if (!data?.id) throw new Error('Email provider did not confirm acceptance')
    return data.id
  } finally { clearTimeout(timer) }
}
