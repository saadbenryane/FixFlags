import { verifyPassword } from 'better-auth/crypto'

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD
  const accountId = process.env.SEED_ADMIN_EMAIL
  if (!password || !accountId) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to verify local credentials.')
  }

  // Get the full hash from the database
  const { prisma } = await import('@/lib/db')
  const account = await prisma.account.findUnique({ 
    where: { providerId_accountId: { providerId: 'credential', accountId } }
  })
  
  if (account?.password) {
    const match = await verifyPassword({ password, hash: account.password })
    console.log('Password match:', match)
  } else {
    console.log('No password found')
  }
}

main().catch(console.error).finally(async () => { 
  const { prisma } = await import('@/lib/db')
  await prisma.$disconnect() 
})
