import { prisma } from '@/lib/db'
import { DEFAULT_SUPPORT_TENANT_SLUG } from '@/lib/live-support/types'

export async function getDefaultSupportTenant() {
  const slug = process.env.SUPPORT_TENANT_SLUG ?? DEFAULT_SUPPORT_TENANT_SLUG
  const tenant = await prisma.supportTenant.findUnique({ where: { slug } })
  if (!tenant) {
    throw new Error(`Support tenant not found: ${slug}. Run db:seed.`)
  }
  return tenant
}

export async function getSupportTenantBySlug(slug: string) {
  return prisma.supportTenant.findUnique({ where: { slug } })
}
