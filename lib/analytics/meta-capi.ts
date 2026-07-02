import { createHash } from 'node:crypto'
import { getEnv } from '@/lib/env'

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

export interface MetaCapiEvent {
  eventName: 'CompleteRegistration' | 'Lead' | 'ViewContent'
  email?: string | null
  eventSourceUrl?: string
  fbc?: string | null
  fbp?: string | null
  clientIp?: string | null
  userAgent?: string | null
  eventId?: string
}

/** Send a server-side Meta Conversions API event (covers iOS / ad-blocker loss). */
export async function sendMetaCapiEvent(event: MetaCapiEvent): Promise<boolean> {
  const env = getEnv()
  const pixelId = env.NEXT_PUBLIC_META_PIXEL_ID
  const token = env.META_CAPI_TOKEN
  if (!pixelId || !token) return false

  const userData: Record<string, unknown> = {}
  if (event.email) userData.em = [sha256(event.email)]
  if (event.fbc) userData.fbc = event.fbc
  if (event.fbp) userData.fbp = event.fbp
  if (event.clientIp) userData.client_ip_address = event.clientIp
  if (event.userAgent) userData.client_user_agent = event.userAgent

  const body = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId ?? `${event.eventName}-${Date.now()}`,
        action_source: 'website',
        event_source_url: event.eventSourceUrl,
        user_data: userData,
      },
    ],
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  return res.ok
}
