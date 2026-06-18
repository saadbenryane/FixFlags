import { getEnv } from '@/lib/env'
import { DEFAULT_SUPPORT_TENANT_SLUG } from '@/lib/live-support/types'
import { prisma } from '@/lib/db'

export async function getDefaultSupportTenant() {
  const slug = getEnv().SUPPORT_TENANT_SLUG ?? DEFAULT_SUPPORT_TENANT_SLUG
  const tenant = await prisma.supportTenant.findUnique({ where: { slug } })
  if (!tenant) {
    throw new Error(`Support tenant not found: ${slug}. Run db:migrate and db:seed.`)
  }
  return tenant
}
