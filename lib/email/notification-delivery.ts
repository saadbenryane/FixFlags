import type { Resend } from 'resend'
import { z } from 'zod'

export const notificationEmailSnapshotSchema = z.object({
  version: z.literal(1), from: z.string().min(1), to: z.string().email(),
  subject: z.string().min(1), html: z.string().min(1), text: z.string().min(1),
  tags: z.array(z.object({ name: z.string(), value: z.string() }).strict()).max(10),
}).strict()

/** Stored ownership and selection metadata never enter the provider request. */
export function notificationEmailBody(payload: z.infer<typeof notificationEmailSnapshotSchema>) {
  return { from: payload.from, to: payload.to, subject: payload.subject, html: payload.html,
    text: payload.text, tags: payload.tags }
}

/** Both monitoring senders abort the physical SDK request before their lease expires. */
export async function sendNotificationEmail(provider: Pick<Resend, 'emails'>,
  message: Parameters<Resend['emails']['send']>[0], idempotencyKey: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('Notification provider deadline')), 20_000)
  try {
    // The installed SDK forwards these fetch options, including the signal.
    const options = { idempotencyKey, signal: controller.signal }
    const { data, error } = await provider.emails.send(message, options)
    if (error) throw new Error(error.message)
    if (!data?.id) throw new Error('Email provider did not confirm acceptance')
    return data.id
  } finally { clearTimeout(timer) }
}
