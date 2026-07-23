import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export async function persistGrowthArtifact(
  kind: string,
  path: string,
  payload: unknown,
): Promise<void> {
  const jsonPayload = payload as Prisma.InputJsonValue
  await prisma.growthArtifact.upsert({
    where: { path },
    create: { kind, path, payload: jsonPayload },
    update: { kind, payload: jsonPayload, writtenAt: new Date() },
  })
}
