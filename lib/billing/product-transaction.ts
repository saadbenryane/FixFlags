import { Prisma } from '@prisma/client'
import { executionTransaction } from '@/lib/audit/execution-ownership'

export class ProductAdmissionBusy extends Error {
  readonly code = 'ADMISSION_BUSY'
  constructor(cause: unknown) {
    super('Site operation remained busy after bounded transaction retries.', { cause })
    this.name = 'ProductAdmissionBusy'
  }
}

const MAX_ADMISSION_ATTEMPTS = 5

/** Serializable admission needs a fresh snapshot after a conflict. Jitter keeps
 * independent requests from repeatedly colliding on the same predicate locks. */
export async function productTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await executionTransaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error
      if (attempt + 1 >= MAX_ADMISSION_ATTEMPTS) throw new ProductAdmissionBusy(error)
      const ceiling = Math.min(400, 50 * 2 ** attempt)
      await new Promise(resolve => setTimeout(resolve, ceiling / 2 + Math.random() * ceiling / 2))
    }
  }
}
