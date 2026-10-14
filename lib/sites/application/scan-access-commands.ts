import { prisma } from '@/lib/db'
import { canUseAuthenticatedScanAccess } from '@/lib/auth/entitlements'
import { decryptScanAccess, redactScanAccessForClient, type ScanAccessConfig } from '@/lib/audit/scan-access'
import { persistProjectScanAccess } from '@/lib/audit/scan-access-store'
import { SiteRunRefusal } from './run-refusal'

async function ownedProject(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId, deletedAt: null }, select: { id: true, scanAccessEncrypted: true } })
  if (!project) throw new SiteRunRefusal('Site not found', 404, 'SITE_NOT_FOUND')
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, plan: true, subscriptionStatus: true } })
  if (!user) throw new SiteRunRefusal('Sign in required', 401)
  if (!canUseAuthenticatedScanAccess(user)) throw new SiteRunRefusal('Website access is unavailable for this account.', 403, 'ACCESS_NOT_ALLOWED')
  return project
}
export async function readSavedScanAccess(projectId: string, userId: string) {
  const project = await ownedProject(projectId, userId)
  const config = decryptScanAccess(project.scanAccessEncrypted)
  if (project.scanAccessEncrypted && !config) throw new SiteRunRefusal('Saved access could not be read. Remove or replace it before starting a private check.', 503, 'ACCESS_UNREADABLE')
  return { configured: Boolean(config), summary: config ? redactScanAccessForClient(config) : null }
}
export async function saveScanAccess(projectId: string, userId: string, config: ScanAccessConfig | null) {
  await ownedProject(projectId, userId)
  await persistProjectScanAccess(projectId, userId, config)
  return { configured: Boolean(config), summary: config ? redactScanAccessForClient(config) : null }
}
