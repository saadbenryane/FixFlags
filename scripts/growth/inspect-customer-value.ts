/** Local, aggregate-only customer value inspection. No production access or writes. */
async function main() {
  const [daysArgument = '30', mode = 'cycles'] = process.argv.slice(2)
  const days = Number(daysArgument)
  if (process.argv.length > 4 || !['cycles', 'acquisition', 'sites'].includes(mode) || !Number.isInteger(days) || days < 1 || days > 90) throw new Error('Invalid window')
  const url = new URL(process.env.DATABASE_URL ?? '')
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Local database required')
  }
  const load = mode === 'sites' ? (await import('@/lib/analytics/site-value-query')).loadSiteValueCohort
    : mode === 'acquisition' ? (await import('@/lib/analytics/acquisition-value-query')).loadAcquisitionValueCohort
    : (await import('@/lib/analytics/improvement-value-query')).loadCustomerValueReport
  const { PrismaClient } = await import('@prisma/client')
  // The shared application client logs Prisma failures. The inspector must not.
  const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
  try {
    const now = new Date()
    console.log(JSON.stringify(await load({ since: new Date(now.getTime() - days * 86_400_000), now }, db), null, 2))
  } finally { await db.$disconnect() }
}

main().catch(() => {
  // Database exceptions may carry credentials, private queries or source identifiers.
  console.error('Customer value inspection failed. Use a loopback PostgreSQL DATABASE_URL, a window of 1 to 90 days and cycles, acquisition or sites mode. No database error or private record was printed.')
  process.exitCode = 1
})
