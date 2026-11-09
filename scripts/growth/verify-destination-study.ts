import { destinationStudyDiscoveryVerified, inspectDestinationStudyPublication } from '@/lib/growth/destination-study-publication'

async function main() {
  const options = process.argv.slice(2)
  if (options.length && (options.length !== 1 || options[0] !== '--require-match')) throw new Error('Invalid options')
  const report = await inspectDestinationStudyPublication({ origin: process.env.SEO_VERIFY_ORIGIN })
  console.log(JSON.stringify(report, null, 2))
  if (report.state === 'unavailable' || report.state === 'canonical-mismatch' || report.state === 'edition-mismatch' ||
    (options.length && (report.state !== 'edition-match' || !destinationStudyDiscoveryVerified(report.discovery)))) process.exitCode = 1
}

main().catch(() => {
  console.error('Study publication check unavailable. Use the public FixFlags origin or a loopback fixture.')
  process.exitCode = 1
})
