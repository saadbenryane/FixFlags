import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { encryptSecret } from '@/lib/security/crypto'
import { requireShopDomain } from '@/lib/shopify/session'

const schema = z.object({
  webhookUrl: z.string().url().max(500),
})

export async function POST(request: NextRequest) {
  const auth = requireShopDomain(request)
  if ('error' in auth) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  if (!parsed.data.webhookUrl.startsWith('https://hooks.slack.com/')) {
    return NextResponse.json({ error: 'Paste a Slack incoming webhook URL' }, { status: 400 })
  }
  const updated = await prisma.shopifyShop.updateMany({
    where: { shopDomain: auth.shop, uninstalledAt: null },
    data: { slackWebhookEncrypted: encryptSecret(parsed.data.webhookUrl) },
  })
  if (updated.count === 0) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
