import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'
import { getAppUrl } from '@/lib/get-app-url'
import { emailRecipientHash } from './delivery-events'

function signature(value: string): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error('Email preference signing is not configured')
  return createHmac('sha256', secret).update(`fixflags:product-tips:v1:${value}`).digest()
}

export function productTipsUnsubscribeUrl(userId: string, email: string): string {
  if (process.env.NODE_ENV === 'production' && new URL(getAppUrl()).protocol !== 'https:')
    throw new Error('Product tips require an HTTPS unsubscribe endpoint')
  const payload = Buffer.from(JSON.stringify({ userId, recipientHash: emailRecipientHash(email) })).toString('base64url')
  return `${getAppUrl()}/api/email/unsubscribe?token=${payload}.${signature(payload).toString('base64url')}`
}

export function readUnsubscribeToken(token: string): { userId: string; recipientHash: string } | null {
  if (token.length > 2048) return null
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return null
    const expected = signature(parts[0]), received = Buffer.from(parts[1], 'base64url')
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    return typeof value.userId === 'string' && value.userId.length > 0 && value.userId.length < 200 &&
      typeof value.recipientHash === 'string' && /^[a-f0-9]{64}$/.test(value.recipientHash) ? value : null
  } catch { return null }
}

export async function unsubscribeProductTips(token: string): Promise<boolean> {
  const identity = readUnsubscribeToken(token)
  if (!identity) return false
  await prisma.$transaction(async tx => {
    const users = await tx.$queryRaw<Array<{ email: string }>>`SELECT email FROM users WHERE id=${identity.userId} FOR UPDATE`
    if (!users[0] || emailRecipientHash(users[0].email) !== identity.recipientHash) return
    await tx.notificationPreference.updateMany({ where: { userId: identity.userId, productTips: true },
      data: { productTips: false } })
  })
  return true
}
