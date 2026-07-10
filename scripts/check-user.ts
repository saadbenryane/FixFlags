import { prisma } from '@/lib/db'

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'saadbenryane@gmail.com' } })
  const account = await prisma.account.findUnique({ 
    where: { providerId_accountId: { providerId: 'credential', accountId: 'saadbenryane@gmail.com' } } 
  })
  console.log('User:', user?.email, user?.emailVerified, user?.role, user?.plan)
  console.log('Account:', account?.providerId, account?.accountId, account?.password?.slice(0,30) + '...')
}

main()
  .catch(console.error)
  .finally(async () => { await prisma.$disconnect() })