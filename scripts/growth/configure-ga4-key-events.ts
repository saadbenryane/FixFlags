#!/usr/bin/env -S npx tsx -r dotenv/config
import { config as loadEnv } from 'dotenv'
import { configureGaKeyEvents } from '@/lib/growth/configure-ga-key-events'
import { GA4_KEY_EVENTS } from '@/lib/growth/ga-key-events'

loadEnv({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' })

async function main(): Promise<void> {
  console.log(`[configure-ga4-key-events] canonical key events: ${GA4_KEY_EVENTS.join(', ')}`)
  const result = await configureGaKeyEvents()
  if (!result) {
    throw new Error('GSC_SERVICE_ACCOUNT_KEY is required (service account needs analytics.edit on the GA4 property)')
  }
  console.log(`[configure-ga4-key-events] property ${result.property}`)
  if (result.created.length) console.log(`created: ${result.created.join(', ')}`)
  if (result.existing.length) console.log(`already configured: ${result.existing.join(', ')}`)
  if (result.failed.length) {
    for (const failure of result.failed) {
      console.error(`failed ${failure.eventName}: ${failure.reason}`)
    }
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[configure-ga4-key-events] fatal:', error)
  process.exit(1)
})
