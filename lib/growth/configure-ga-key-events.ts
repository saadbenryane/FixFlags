import { google } from 'googleapis'
import { GA4_KEY_EVENTS } from '@/lib/growth/ga-key-events'
import { googleServiceAccount } from '@/lib/growth/google-auth'
import { ANALYTICS_JOURNEY_PARAM } from '@/lib/analytics/journey-id'

export const GA4_JOURNEY_DIMENSION = {
  parameterName: ANALYTICS_JOURNEY_PARAM,
  displayName: 'FixFlags journey ID',
  description: 'Opaque consented browser-session key used to join landing acquisition to a Site start.',
  scope: 'EVENT',
} as const

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
  journeyDimension: {
    status: 'created' | 'existing' | 'failed'
    reason?: string
  }
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
  const customDimensions = await admin.properties.customDimensions.list({
    parent: property,
    pageSize: 200,
  })
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

  let journeyDimension: ConfigureGaKeyEventsResult['journeyDimension']
  const existingJourneyDimension = (customDimensions.data.customDimensions ?? []).find(
    (dimension) => dimension.parameterName === GA4_JOURNEY_DIMENSION.parameterName,
  )
  if (existingJourneyDimension?.scope === GA4_JOURNEY_DIMENSION.scope) {
    journeyDimension = { status: 'existing' }
  } else if (existingJourneyDimension) {
    journeyDimension = {
      status: 'failed',
      reason: `Existing ${GA4_JOURNEY_DIMENSION.parameterName} dimension has scope ${existingJourneyDimension.scope ?? 'unknown'}, expected EVENT`,
    }
  } else {
    try {
      await admin.properties.customDimensions.create({
        parent: property,
        requestBody: GA4_JOURNEY_DIMENSION,
      })
      journeyDimension = { status: 'created' }
    } catch (error) {
      journeyDimension = {
        status: 'failed',
        reason: error instanceof Error ? error.message : String(error),
      }
    }
  }

  return { property, created, existing, failed, journeyDimension }
}
