import { PrismaClient } from '@prisma/client'
import { budgetDatabaseUrl } from './runtime/database-budget.mjs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(process.env.DATABASE_URL ? { datasources: { db: { url: budgetDatabaseUrl(process.env.DATABASE_URL, process.env.FIXFLAGS_PROCESS_ROLE) } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
