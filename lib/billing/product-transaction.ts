import { Prisma } from '@prisma/client'
import { executionTransaction } from '@/lib/audit/execution-ownership'

/** Retry admission against a fresh snapshot after concurrent Site creation. */
export async function productTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await executionTransaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error
    }
  }
}
