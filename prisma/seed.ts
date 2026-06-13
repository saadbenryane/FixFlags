import { PrismaClient } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { UNLIMITED_SCAN_LIMIT } from '../lib/auth/permissions'

const prisma = new PrismaClient()

const ADMIN_EMAIL = 'saadbenryane@gmail.com'
const ADMIN_PASSWORD = 'password123'

async function main() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD)

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      name: 'Admin',
      emailVerified: true,
      role: 'admin',
      plan: 'STUDIO',
      auditsUsed: 0,
      auditsLimit: UNLIMITED_SCAN_LIMIT,
    },
    update: {
      role: 'admin',
      plan: 'STUDIO',
      auditsLimit: UNLIMITED_SCAN_LIMIT,
      emailVerified: true,
    },
  })

  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: 'credential',
        accountId: ADMIN_EMAIL,
      },
    },
    create: {
      userId: user.id,
      providerId: 'credential',
      accountId: ADMIN_EMAIL,
      password: passwordHash,
    },
    update: {
      password: passwordHash,
    },
  })

  console.log(`Seeded admin user: ${ADMIN_EMAIL}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
