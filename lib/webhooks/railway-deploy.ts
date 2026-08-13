import { z } from 'zod'

const railwayWebhookSchema = z
  .object({
    type: z.string(),
    details: z
      .object({
        status: z.string().optional(),
        url: z.string().url().optional(),
      })
      .optional(),
    deployment: z
      .object({
        id: z.string().optional(),
        status: z.string().optional(),
        url: z.string().url().optional(),
        commitHash: z.string().optional(),
      })
      .optional(),
    service: z
      .object({
        url: z.string().url().optional(),
      })
      .optional(),
    resource: z
      .object({
        service: z
          .object({
            url: z.string().url().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .passthrough()

export type RailwayWebhookPayload = z.infer<typeof railwayWebhookSchema>

export function parseRailwayWebhookPayload(raw: unknown): RailwayWebhookPayload | null {
  const parsed = railwayWebhookSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function railwayDeploymentReference(payload: RailwayWebhookPayload): {
  externalId: string
  commitRef: string | null
} {
  return {
    externalId: payload.deployment?.id ?? `railway:${payload.type}`,
    commitRef: payload.deployment?.commitHash ?? null,
  }
}

/** True when Railway signals a successful deployment (ignore builds, failures, crashes). */
export function isRailwayDeploySuccessEvent(payload: RailwayWebhookPayload): boolean {
  const type = payload.type.trim()
  const normalized = type.toLowerCase().replace(/\./g, '_')

  if (
    normalized.includes('fail') ||
    normalized.includes('crash') ||
    normalized.includes('removed') ||
    normalized.includes('started') ||
    normalized.includes('building') ||
    normalized.includes('deploying') ||
    normalized === 'deploy'
  ) {
    return false
  }

  if (
    normalized.includes('success') ||
    normalized.includes('succeeded') ||
    normalized.includes('completed')
  ) {
    const status = (payload.details?.status ?? payload.deployment?.status ?? '').toUpperCase()
    if (status && status !== 'SUCCESS') return false
    return true
  }

  const status = (payload.details?.status ?? payload.deployment?.status ?? '').toUpperCase()
  return status === 'SUCCESS'
}

export function resolveRailwayCheckUrl(
  payload: RailwayWebhookPayload,
  configuredUrl: string | null
): string | null {
  if (configuredUrl?.trim()) return configuredUrl.trim()
  return (
    payload.details?.url ??
    payload.deployment?.url ??
    payload.service?.url ??
    payload.resource?.service?.url ??
    null
  )
}
