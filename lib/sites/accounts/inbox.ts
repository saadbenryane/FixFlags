import * as cheerio from 'cheerio'
import { z } from 'zod'
import { boundedText } from '@/lib/security/bounded-body'
import { prisma } from '@/lib/db'
import { encryptSecret } from '@/lib/security/crypto'
import { waitForEmailProviderCapacity } from '@/lib/email/provider-admission'

export const receivingEventSchema = z.object({ type: z.literal('email.received'),
  data: z.object({ email_id: z.string().uuid(), to: z.array(z.string().email()).max(20), created_at: z.string().datetime().optional() }) })
export const verificationSchema = z.object({ links: z.array(z.string().url()).max(5), code: z.string().regex(/^\d{4,8}$/).nullable() }).strict()

export { verifySvixSignature as verifyReceivingSignature } from '@/lib/security/svix'
export { boundedText } from '@/lib/security/bounded-body'

export function extractVerification(input: { html?: string | null; text?: string | null; origin: string }) {
  const $ = cheerio.load((input.html ?? '').slice(0, 512_000)); $('script, style').remove()
  const text = `${input.text ?? ''} ${$.text()}`.slice(0, 512_000)
  const candidates = [...$('a[href]').map((_, element) => $(element).attr('href') ?? '').get(),
    ...(text.match(/https:\/\/[^\s<>"']+/g) ?? [])]
  const links = [...new Set(candidates)].filter(value => {
    try { const url = new URL(value)
      return url.protocol === 'https:' && url.origin === input.origin && !url.username && !url.password &&
        /(?:verify|verification|confirm|activate)/i.test(url.pathname) && !/(delete|reset|unsubscribe|payment)/i.test(url.pathname) &&
        ![...url.searchParams.entries()].some(([key, value]) => /^(?:action|type|purpose)$/i.test(key) && /(?:delete|reset|unsubscribe|change.email)/i.test(value))
    } catch { return false }
  }).slice(0, 5)
  const codes = [...text.matchAll(/(?:verification|security|confirmation|one.time|login)\s+code\s*(?:is|:)?\s*(\d{4,8})\b/gi)].map(match => match[1])
  return verificationSchema.parse({ links, code: new Set(codes).size === 1 ? codes[0] : null })
}

export async function acceptReceivingEmail(event: z.infer<typeof receivingEventSchema>) {
  if (await prisma.siteAccountMessage.findUnique({ where: { providerId: event.data.email_id }, select: { id: true } })) return
  const now = new Date()
  const accounts = await prisma.siteTestAccount.findMany({ where: { email: { in: event.data.to.map(value => value.toLowerCase()) },
    state: { in: ['SUBMITTING', 'VERIFYING'] }, submittedAt: { gte: new Date(now.getTime() - 15 * 60_000) },
    project: { deletedAt: null, accountChecksEnabled: true } }, take: 2 })
  // A received email cannot cross account/tenant boundaries or choose a target.
  if (accounts.length !== 1) return
  const account = accounts[0]!
  const signal = AbortSignal.timeout(8000)
  await waitForEmailProviderCapacity(signal)
  const response = await fetch(`https://api.resend.com/emails/receiving/${event.data.email_id}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, redirect: 'error', signal, cache: 'no-store' })
  if (!response.ok) { await response.body?.cancel(); throw new Error('Received email is temporarily unavailable') }
  const raw = JSON.parse(await boundedText(response.body, 1_048_576))
  const body = z.object({ to: z.array(z.string().email()), html: z.string().nullable().optional(), text: z.string().nullable().optional(),
    created_at: z.string().datetime() }).parse(raw)
  if (!body.to.some(value => value.toLowerCase() === account.email) || !account.submittedAt ||
    new Date(body.created_at).getTime() < account.submittedAt.getTime() - 5000) return
  const extracted = extractVerification({ ...body, origin: account.origin })
  if (!extracted.links.length && !extracted.code) return
  await prisma.$transaction(async tx => {
    const current = await tx.siteTestAccount.findFirst({ where: { id: account.id, email: account.email,
      operationId: account.operationId, state: { in: ['SUBMITTING', 'VERIFYING'] }, project: { deletedAt: null, accountChecksEnabled: true } } })
    if (!current) return
    await tx.siteAccountMessage.upsert({ where: { providerId: event.data.email_id }, update: {},
      create: { providerId: event.data.email_id, accountId: account.id, encryptedVerification: encryptSecret(JSON.stringify(extracted)),
        expiresAt: new Date(account.submittedAt!.getTime() + 15 * 60_000) } })
    await tx.siteAccountMessage.deleteMany({ where: { expiresAt: { lte: now } } })
  })
}
