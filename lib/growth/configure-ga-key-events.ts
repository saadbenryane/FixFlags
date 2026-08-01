import { google } from 'googleapis'
import { GA4_KEY_EVENTS } from '@/lib/growth/ga-key-events'
import { googleServiceAccount } from '@/lib/growth/google-auth'

function propertyResource(): string {
  const raw = process.env.GA4_PROPERTY_ID?.trim()
  if (!raw) throw new Error('GA4_PROPERTY_ID env var is required')
  return raw.startsWith('properties/') ? raw : `properties/${raw}`
}

export interface ConfigureGaKeyEventsResult {
  property: string
  created: string[]
  existing: string[]
  failed: Array<{ eventName: string; reason: string }>
}

export async function configureGaKeyEvents(): Promise<ConfigureGaKeyEventsResult | null> {
  const auth = await googleServiceAccount([
    'https://www.googleapis.com/auth/analytics.edit',
  ])
  if (!auth) return null

  const property = propertyResource()
  const admin = google.analyticsadmin({
    version: 'v1beta',
    auth: auth as unknown as Parameters<typeof google.analyticsadmin>[0]['auth'],
  })

  const listed = await admin.properties.keyEvents.list({ parent: property })
  const existingNames = new Set(
    (listed.data.keyEvents ?? [])
      .map((event) => event.eventName)
      .filter((name): name is string => Boolean(name)),
  )

  const created: string[] = []
  const existing: string[] = []
  const failed: Array<{ eventName: string; reason: string }> = []

  for (const eventName of GA4_KEY_EVENTS) {
    if (existingNames.has(eventName)) {
      existing.push(eventName)
      continue
    }
    try {
      await admin.properties.keyEvents.create({
        parent: property,
        requestBody: {
          eventName,
          countingMethod: 'ONCE_PER_EVENT',
        },
      })
      created.push(eventName)
    } catch (error) {
      failed.push({
        eventName,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { property, created, existing, failed }
}
