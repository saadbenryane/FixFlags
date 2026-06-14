/**
 * Capture Stripe sample screenshots into public/samples/.
 * Run: npx tsx scripts/capture-sample-screenshots.ts
 */
import fs from 'fs/promises'
import path from 'path'
import { captureScreenshots, closeBrowser } from '../lib/audit/screenshot'
import { getLocalScreenshotPath } from '../lib/storage/screenshots'

const AUDIT_ID = 'sample-stripe-capture'
const URL = 'https://stripe.com'

async function main() {
  process.env.NEXT_PUBLIC_APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  console.log(`Capturing ${URL}...`)
  const result = await captureScreenshots(URL, AUDIT_ID)

  if (!result.desktopUrl) {
    throw new Error('Desktop capture failed')
  }

  const outDir = path.join(process.cwd(), 'public', 'samples')
  await fs.mkdir(outDir, { recursive: true })

  await fs.copyFile(
    getLocalScreenshotPath(AUDIT_ID, 'desktop'),
    path.join(outDir, 'stripe-desktop.webp')
  )

  if (result.mobileUrl) {
    await fs.copyFile(
      getLocalScreenshotPath(AUDIT_ID, 'mobile'),
      path.join(outDir, 'stripe-mobile.webp')
    )
  } else {
    console.warn('Mobile capture failed — stripe-mobile.webp not updated')
  }

  console.log('Sample screenshots written to', outDir)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => closeBrowser())
