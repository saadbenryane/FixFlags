import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { enqueueIntegrityProbe } from '@/lib/integrity/enqueue'
import { requireShopDomain } from '@/lib/shopify/session'

export async function POST(request: NextRequest) {
  const auth = requireShopDomain(request)
  if ('error' in auth) return auth.error
  const body = (await request.json().catch(() => null)) as { pathId?: string } | null
  if (!body?.pathId) return NextResponse.json({ error: 'pathId required' }, { status: 400 })
  const path = await prisma.revenuePath.findFirst({
    where: { id: body.pathId, shop: { shopDomain: auth.shop, uninstalledAt: null } },
    select: { id: true },
  })
  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const used = await prisma.verificationRun.count({
    where: {
      path: { shop: { shopDomain: auth.shop } },
      trigger: 'manual',
      createdAt: { gte: start },
    },
  })
  if (used >= 5) {
    return NextResponse.json({ error: 'Daily recheck limit reached' }, { status: 429 })
  }
  await enqueueIntegrityProbe(path.id, 'manual')
  return NextResponse.json({ ok: true })
}
