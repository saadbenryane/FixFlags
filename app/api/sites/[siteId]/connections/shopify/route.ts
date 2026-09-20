import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { prisma } from '@/lib/db'
import { createShopifyAccountLink, disconnectShopifySite } from '@/lib/shopify/account-link'
import { isShopifyConfigured, normalizeShopDomain } from '@/lib/shopify/config'
import { buildShopifyAuthorizeUrl, signShopifyInstallState } from '@/lib/shopify/oauth'
import { requireSiteAccess } from '@/lib/sites/request-access'

const connectSchema = z.object({ shop: z.string().trim().min(1).max(255) })

async function ownerContext(siteId: string) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user?.id) return { error: apiError('Sign in to manage Site connections.', 401) }
  const access = await requireSiteAccess(siteId)
  if (!access.ok) return { error: apiError(access.message, access.status) }
  if (access.decision.role !== 'owner' || !access.decision.site.projectId) {
    return { error: apiError('Claim this Site before connecting Shopify.', 403) }
  }
  return {
    userId: session.user.id,
    projectId: access.decision.site.projectId,
  }
}

export async function GET(_request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const owner = await ownerContext(siteId)
    if ('error' in owner) return owner.error
    const shop = await prisma.shopifyShop.findUnique({
      where: { projectId: owner.projectId },
      select: { shopDomain: true, name: true, linkedAt: true, uninstalledAt: true },
    })
    return NextResponse.json({
      state: !shop ? 'not_connected' : shop.uninstalledAt ? 'unavailable' : 'connected',
      shop: shop ? { domain: shop.shopDomain, name: shop.name, linkedAt: shop.linkedAt } : null,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    if (!isShopifyConfigured()) return apiError('Shopify connections are temporarily unavailable.', 503)
    const { siteId } = await context.params
    const owner = await ownerContext(siteId)
    if ('error' in owner) return owner.error
    const parsed = connectSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Enter a store like your-store.myshopify.com.', 400)
    const shop = normalizeShopDomain(parsed.data.shop)
    if (!shop) return apiError('Enter a store like your-store.myshopify.com.', 400)

    const token = await createShopifyAccountLink(owner)
    const state = signShopifyInstallState(shop, token)
    return NextResponse.json({ authorizeUrl: buildShopifyAuthorizeUrl(shop, state) })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const owner = await ownerContext(siteId)
    if ('error' in owner) return owner.error
    await disconnectShopifySite(owner)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
