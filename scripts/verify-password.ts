import { verifyPassword } from 'better-auth/crypto'

async function main() {
  const password = 'password123'
  const fullHash = 'c220add1e40fe70a86711538aeeb5c...'  // We need the full hash
  
  // Get the full hash from the database
  const { prisma } = await import('@/lib/db')
  const account = await prisma.account.findUnique({ 
    where: { providerId_accountId: { providerId: 'credential', accountId: 'saadbenryane@gmail.com' } } 
  })
  
  if (account?.password) {
    const match = await verifyPassword(password, account.password)
    console.log('Password match:', match)
    console.log('Full hash:', account.password)
  } else {
    console.log('No password found')
  }
}

main().catch(console.error).finally(async () => { 
  const { prisma } = await import('@/lib/db')
  await prisma.$disconnect() 
})