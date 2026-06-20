import { getAuditBrowser } from '@/lib/audit/screenshot'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { discoverFlowCtasWithFallback } from '@/lib/audit/flow/discover-cta'
import { runMultiStepProbes } from '@/lib/audit/flow/nav-probes'

const url = 'http://localhost:3000/demo/v1'

async function main() {
  const b = await getAuditBrowser()
  const { page } = await createAuditPage(b, url, {
    profile: DESKTOP_CAPTURE_PROFILE,
    allowLocalhost: true,
  })
  const before = await discoverFlowCtasWithFallback(page, url)
  console.log('before probes', before)
  const probes = await runMultiStepProbes(page, url)
  console.log('probes', probes)
  const after = await discoverFlowCtasWithFallback(page, url)
  console.log('after probes', after)
  console.log('viewport', page.viewport())
  await page.close()
  await b.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
