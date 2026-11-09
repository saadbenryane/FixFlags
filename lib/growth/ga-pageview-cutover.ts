import { z } from 'zod'
import { googleServiceAccount } from './google-auth'
import { FIXFLAGS_GA_MEASUREMENT_ID, FIXFLAGS_GA_PROPERTY, FIXFLAGS_GA_WEB_STREAM, FIXFLAGS_HOST } from './reporting-targets'

const origin = `https://${FIXFLAGS_HOST}`
const streamResource = `properties/${FIXFLAGS_GA_PROPERTY}/dataStreams/${FIXFLAGS_GA_WEB_STREAM}`
const settingsResource = `${streamResource}/enhancedMeasurementSettings`
const readonlyScope = 'https://www.googleapis.com/auth/analytics.readonly'
const webStream = z.object({
  name: z.literal(streamResource),
  type: z.literal('WEB_DATA_STREAM'),
  webStreamData: z.object({
    measurementId: z.literal(FIXFLAGS_GA_MEASUREMENT_ID),
    defaultUri: z.enum([origin, origin + '/']),
  }),
})
const settings = z.object({
  name: z.literal(settingsResource),
  streamEnabled: z.boolean().optional(),
  pageChangesEnabled: z.boolean().optional(),
})

/** Verify the provider prerequisite against the known FixFlags web stream. */
export async function inspectGaPageviewCutover(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const receipt = {
    version: 1,
    checkedAt: new Date().toISOString(),
    providerWritten: false,
    databaseWritten: false,
    candidateBuildVerified: false,
    runtimeVerified: false,
  } as const
  if (env.NEXT_PUBLIC_GA_PAGEVIEW_MODE !== 'controlled') return { ...receipt, status: 'candidate-mode-mismatch' } as const
  if (env.NEXT_PUBLIC_GA_ID?.trim() !== FIXFLAGS_GA_MEASUREMENT_ID) return { ...receipt, status: 'candidate-measurement-mismatch' } as const
  if (env.GA4_PROPERTY_ID?.trim().replace(/^properties\//, '') !== FIXFLAGS_GA_PROPERTY) {
    return { ...receipt, status: 'property-mismatch' } as const
  }

  try {
    const auth = await googleServiceAccount([readonlyScope])
    if (!auth) return { ...receipt, status: 'credential-unavailable' } as const
    const [stream, measurement] = await Promise.all([
      auth.request({ method: 'GET', url: `https://analyticsadmin.googleapis.com/v1beta/${streamResource}`, timeout: 10_000 }),
      auth.request({ method: 'GET', url: `https://analyticsadmin.googleapis.com/v1alpha/${settingsResource}`, timeout: 10_000 }),
    ])
    if (!webStream.safeParse(stream.data).success) return { ...receipt, status: 'web-stream-mismatch' } as const
    const parsed = settings.safeParse(measurement.data)
    if (!parsed.success) return { ...receipt, status: 'settings-unverified' } as const
    const enhancedMeasurement = parsed.data.streamEnabled ?? null
    const browserHistoryPageviews = parsed.data.pageChangesEnabled ?? null
    const historyDisabled = enhancedMeasurement === false || browserHistoryPageviews === false
    const status = historyDisabled ? 'provider-prerequisite-met' as const :
      enhancedMeasurement === true && browserHistoryPageviews === true ? 'browser-history-enabled' as const : 'settings-unverified' as const
    return { ...receipt, status, webStreamVerified: true, enhancedMeasurement, browserHistoryPageviews }
  } catch {
    return { ...receipt, status: 'provider-read-unavailable' } as const
  }
}
