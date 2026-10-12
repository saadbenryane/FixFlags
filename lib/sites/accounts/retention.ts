import { prisma } from '@/lib/db'

/** Expired verification tokens are purged independently of account execution. */
export async function deleteExpiredAccountMessages(now = new Date()) {
  const result = await prisma.siteAccountMessage.deleteMany({ where: { expiresAt: { lte: now } } })
  return result.count
}
