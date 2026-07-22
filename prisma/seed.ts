import { PrismaClient } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { UNLIMITED_SCAN_LIMIT } from '../lib/auth/permissions'

const prisma = new PrismaClient()

function requiredSeedValue(name: 'SEED_ADMIN_EMAIL' | 'SEED_ADMIN_PASSWORD'): string {
  const value = process.env[name]
  if (!value || (name === 'SEED_ADMIN_PASSWORD' && value.length < 12)) {
    throw new Error(
      'Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (12+ characters) before running db:seed.'
    )
  }
  return value
}

const ADMIN_EMAIL = requiredSeedValue('SEED_ADMIN_EMAIL')
const ADMIN_PASSWORD = requiredSeedValue('SEED_ADMIN_PASSWORD')

async function main() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD)

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      name: 'Admin',
      emailVerified: true,
      role: 'admin',
      plan: 'TEAM',
      auditsUsed: 0,
      auditsLimit: UNLIMITED_SCAN_LIMIT,
    },
    update: {
      role: 'admin',
      plan: 'TEAM',
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

  await prisma.supportTenant.upsert({
    where: { slug: 'fixflags' },
    create: {
      slug: 'fixflags',
      name: 'FixFlags',
      isUnlimited: true,
      ownerUserId: user.id,
    },
    update: {
      name: 'FixFlags',
      isUnlimited: true,
      ownerUserId: user.id,
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
