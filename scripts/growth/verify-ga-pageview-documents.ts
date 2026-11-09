import { verifyGaPageviewDocuments } from '@/lib/growth/ga-pageview-document'

async function main() {
  if (process.argv.length !== 2) throw new Error('Invalid arguments')
  const report = await verifyGaPageviewDocuments({ origin: process.env.SEO_VERIFY_ORIGIN })
  console.log(JSON.stringify(report, null, 2))
  if (!report.controlledDocumentsVerified) process.exitCode = 1
}

main().catch(() => {
  console.error('Controlled pageview document verification unavailable. Use the public FixFlags origin or a loopback candidate.')
  process.exitCode = 1
})
