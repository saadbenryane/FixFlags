import type { Prisma } from '@prisma/client'

/** Can't buy / recovered purchase paths become the same Flag object on a matching Site. */
export async function upsertIntegritySiteFlag(input: {
  projectId: string
  pathId: string
  pathLabel: string
  storefrontUrl: string
  health: 'GREEN' | 'RED' | 'UNKNOWN'
  reason: string
}, tx: Pick<Prisma.TransactionClient, 'project' | 'improvement'>): Promise<{ projectId: string } | null> {
  if (input.health === 'UNKNOWN') return null
  const project = await tx.project.findUnique({
    where: { id: input.projectId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
    select: { id: true },
  })
  if (!project) return null

  const fingerprint = `integrity:${input.pathId}`
  if (input.health === 'RED') {
    await tx.improvement.upsert({
      where: { projectId_fingerprint: { projectId: project.id, fingerprint } },
      create: {
        projectId: project.id,
        fingerprint,
        title: `Customers can't buy: ${input.pathLabel}`,
        judgment: input.reason,
        expectedBenefit: 'Visitors can complete this purchase path.',
        recommendedChange: 'Fix the named step on the live storefront, then Verify.',
        successCondition: 'The same purchase path completes without the failed step.',
        priority: 0,
        status: 'PROPOSED',
      },
      update: {
        title: `Customers can't buy: ${input.pathLabel}`,
        judgment: input.reason,
        status: 'PROPOSED',
      },
    })
  }
  // A GREEN probe deliberately changes nothing. `VERIFIED` is FixFlags' claim that a
  // fresh comparable execution proved the flagged behaviour was restored, and the
  // Site Agent and run reconciliation both read it as exactly that. This probe walks
  // one URL, so treating it as recovery proof let a single flaky pass resolve a Flag
  // the customer was told stays open until the same page and action pass. Recovery is
  // proven by the Verify path, which runs the real check and records the attempt.
  return { projectId: project.id }
}
