import { Prisma } from '@prisma/client'
import { executionTransaction } from '@/lib/audit/execution-ownership'

export class ProductAdmissionBusy extends Error {
  readonly code = 'ADMISSION_BUSY'
  constructor(cause: unknown) {
    super('Site operation remained busy after bounded transaction retries.', { cause })
    this.name = 'ProductAdmissionBusy'
  }
}

/** Serializable admission uses the shared transaction retry. A conflict that
 * remains is busy, not a second admission or a discarded Site check. */
export async function productTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await executionTransaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ProductAdmissionBusy(error)
    throw error
  }
}
