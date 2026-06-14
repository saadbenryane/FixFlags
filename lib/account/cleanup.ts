import { prisma } from '@/lib/db'
import { deleteAuditScreenshotAssets } from '@/lib/storage/screenshots'

export async function deleteUserProductData(userId: string): Promise<void> {
  const audits = await prisma.audit.findMany({
    where: { userId },
    select: { id: true },
  })
  await deleteAuditScreenshotAssets(audits.map((audit) => audit.id))
  await prisma.$transaction([
    prisma.expertReviewOrder.deleteMany({ where: { userId } }),
    prisma.audit.deleteMany({ where: { userId } }),
    prisma.project.deleteMany({ where: { userId } }),
    prisma.apiKey.deleteMany({ where: { userId } }),
    prisma.emailLog.deleteMany({ where: { userId } }),
  ])
}
