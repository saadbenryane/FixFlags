/**
 * Signup count: print how many people have signed up.
 *
 * Reports total registered users (the real "signups"), how many have
 * verified their email, a breakdown by plan, recent signups, and the
 * separate newsletter subscriber list.
 *
 * Run: DOTENV_CONFIG_PATH=.env.local tsx -r dotenv/config scripts/signup-count.ts
 * Or:  npm run signups
 */
import { prisma } from '@/lib/db'

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length)
}

async function main() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    verifiedUsers,
    last24h,
    last7d,
    last30d,
    byPlan,
    newsletterTotal,
    newsletterConfirmed,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { createdAt: { gte: since24h } } }),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.user.count({ where: { createdAt: { gte: since30d } } }),
    prisma.user.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.newsletterSubscriber.count(),
    prisma.newsletterSubscriber.count({ where: { status: 'CONFIRMED' } }),
  ])

  console.log('FixFlags signups\n')
  console.log(`Total signups:      ${totalUsers}`)
  console.log(`Email verified:     ${verifiedUsers}`)
  console.log(`New in last 24h:    ${last24h}`)
  console.log(`New in last 7d:     ${last7d}`)
  console.log(`New in last 30d:    ${last30d}`)

  console.log('\nBy plan:')
  for (const row of [...byPlan].sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${pad(row.plan, 12)} ${row._count._all}`)
  }

  console.log('\nNewsletter subscribers:')
  console.log(`  ${pad('total', 12)} ${newsletterTotal}`)
  console.log(`  ${pad('confirmed', 12)} ${newsletterConfirmed}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
