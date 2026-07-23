import { prisma } from '@/lib/db'
import {
  decryptScanAccess,
  encryptScanAccess,
  type ScanAccessConfig,
} from '@/lib/audit/scan-access'

export async function resolveAuditScanAccess(auditId: string): Promise<ScanAccessConfig | null> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: {
      scanAccessEncrypted: true,
      project: { select: { scanAccessEncrypted: true } },
    },
  })
  if (!audit) return null
  return (
    decryptScanAccess(audit.scanAccessEncrypted) ??
    decryptScanAccess(audit.project?.scanAccessEncrypted)
  )
}

export async function persistAuditScanAccess(
  auditId: string,
  config: ScanAccessConfig | null
): Promise<void> {
  await prisma.audit.update({
    where: { id: auditId },
    data: { scanAccessEncrypted: config ? encryptScanAccess(config) : null },
  })
}

export async function persistProjectScanAccess(
  projectId: string,
  userId: string,
  config: ScanAccessConfig | null
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  })
  if (!project) throw new Error('Project not found')
  await prisma.project.update({
    where: { id: projectId },
    data: { scanAccessEncrypted: config ? encryptScanAccess(config) : null },
  })
}
