import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { trackEvent } from '@/lib/analytics/events'
import { prisma } from '@/lib/db'
import { requireShopDomain } from '@/lib/shopify/session'

const schema = z.object({
  featureKey: z.string().min(2).max(64),
  email: z.string().email().optional(),
})

export async function POST(request: NextRequest) {
  const auth = requireShopDomain(request)
  if ('error' in auth) return auth.error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const shop = await prisma.shopifyShop.findFirst({
    where: { shopDomain: auth.shop, uninstalledAt: null },
  })
  if (!shop) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const email = parsed.data.email ?? shop.email
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  await prisma.integrityWaitlist.upsert({
    where: { shopId_featureKey: { shopId: shop.id, featureKey: parsed.data.featureKey } },
    create: { shopId: shop.id, featureKey: parsed.data.featureKey, email },
    update: { email },
  })
  trackEvent('waitlist_joined', { plan: parsed.data.featureKey, source: 'shopify' })
  return NextResponse.json({ ok: true })
}
