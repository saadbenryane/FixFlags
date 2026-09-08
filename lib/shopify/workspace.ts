import { HEALTH_COPY, REASON_COPY, STEP_COPY } from '@/lib/marketing/copy/shopify'

export type PathHealth = 'GREEN' | 'RED' | 'UNKNOWN'

export interface WorkspaceStep {
  label: string
  title: string
  url: string
  screenshotUrl: string | null
  failed: boolean
}

export interface WorkspaceRun {
  id: string
  health: PathHealth
  reason: string
  reasonLabel: string
  trigger: string
  videoUrl: string | null
  gifUrl: string | null
  createdAt: string
  steps: WorkspaceStep[]
}

export interface WorkspaceImproveItem {
  id: string
  group: string
  title: string
  why: string
  evidenceUrl: string | null
}

export interface WorkspacePath {
  id: string
  label: string
  storefrontUrl: string
  health: PathHealth
  healthLabel: string
  reasonLabel: string
  failedStep: string | null
  lastVerifiedAt: string | null
  walking: boolean
  videoUrl: string | null
  gifUrl: string | null
  screenshotUrl: string | null
  videoMissing: boolean
  runs: WorkspaceRun[]
  improve: WorkspaceImproveItem[]
}

export interface ShopifyWorkspace {
  shop: {
    shopDomain: string
    name: string | null
    email: string | null
    hasSlack: boolean
  }
  storeHealth: PathHealth
  storeHeadline: string
  openIncident: { pathId: string; label: string; reasonLabel: string } | null
  lastRecovery: { pathId: string; label: string } | null
  emptyCatalog: boolean
  walking: boolean
  paths: WorkspacePath[]
  waitlist: string[]
  rechecksRemaining: number
}

const DEFAULT_STEPS = ['landing', 'add_to_cart', 'cart', 'checkout'] as const

function stepsFromEvidence(evidence: unknown, failedStep: string | null): WorkspaceStep[] {
  if (!evidence || typeof evidence !== 'object') {
    return DEFAULT_STEPS.map((label) => ({
      label,
      title: STEP_COPY[label] ?? label,
      url: '',
      screenshotUrl: null,
      failed: label === failedStep,
    }))
  }
  const raw = (evidence as { steps?: unknown }).steps
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_STEPS.map((label) => ({
      label,
      title: STEP_COPY[label] ?? label,
      url: '',
      screenshotUrl: null,
      failed: label === failedStep,
    }))
  }
  return raw.flatMap((step) => {
    if (!step || typeof step !== 'object' || !('label' in step)) return []
    const label = String((step as { label: string }).label)
    return [{
      label,
      title: STEP_COPY[label] ?? label,
      url: String((step as { url?: string }).url ?? ''),
      screenshotUrl: (step as { screenshotUrl?: string | null }).screenshotUrl ?? null,
      failed: label === failedStep,
    }]
  })
}

export function buildShopifyWorkspace(input: {
  shop: {
    shopDomain: string
    name: string | null
    email: string | null
    slackWebhookEncrypted: string | null
  }
  paths: Array<{
    id: string
    label: string
    storefrontUrl: string
    health: PathHealth
    reason: string | null
    failedStep: string | null
    lastVerifiedAt: Date | null
    lastVideoUrl: string | null
    lastGifUrl: string | null
    lastScreenshotUrl: string | null
    lastTransitionAt: Date | null
    runs: Array<{
      id: string
      health: PathHealth
      reason: string
      trigger: string
      videoUrl: string | null
      gifUrl: string | null
      createdAt: Date
      evidence: unknown
    }>
    improveItems: Array<{
      id: string
      group: string
      title: string
      why: string
      evidenceUrl: string | null
    }>
  }>
  waitlist: string[]
  rechecksRemaining: number
}): ShopifyWorkspace {
  const paths: WorkspacePath[] = input.paths.map((path) => {
    const walking = !path.lastVerifiedAt
    const videoUrl = path.lastVideoUrl
    const gifUrl = path.lastGifUrl
    return {
      id: path.id,
      label: path.label,
      storefrontUrl: path.storefrontUrl,
      health: path.health,
      healthLabel: HEALTH_COPY[path.health].label,
      reasonLabel: REASON_COPY[path.reason ?? ''] ?? HEALTH_COPY[path.health].short,
      failedStep: path.failedStep,
      lastVerifiedAt: path.lastVerifiedAt?.toISOString() ?? null,
      walking,
      videoUrl,
      gifUrl,
      screenshotUrl: path.lastScreenshotUrl,
      videoMissing: !walking && !videoUrl && !gifUrl,
      runs: path.runs.map((run) => ({
        id: run.id,
        health: run.health,
        reason: run.reason,
        reasonLabel: REASON_COPY[run.reason] ?? run.reason,
        trigger: run.trigger,
        videoUrl: run.videoUrl,
        gifUrl: run.gifUrl,
        createdAt: run.createdAt.toISOString(),
        steps: stepsFromEvidence(run.evidence, path.failedStep),
      })),
      improve: path.improveItems,
    }
  })

  const emptyCatalog = paths.length === 0
  const walking = paths.some((path) => path.walking)
  const red = paths.find((path) => path.health === 'RED')
  const storeHealth: PathHealth = red ? 'RED' : paths.some((path) => path.health === 'UNKNOWN' || path.walking)
    ? 'UNKNOWN'
    : paths.length
      ? 'GREEN'
      : 'UNKNOWN'

  const recovered = input.paths.find(
    (path) => path.health === 'GREEN' && path.lastTransitionAt && path.reason === 'checkout_reached'
  )

  return {
    shop: {
      shopDomain: input.shop.shopDomain,
      name: input.shop.name,
      email: input.shop.email,
      hasSlack: Boolean(input.shop.slackWebhookEncrypted),
    },
    storeHealth,
    storeHeadline: emptyCatalog
      ? 'No buyable product with a storefront URL yet.'
      : walking
        ? 'Walking the path to checkout.'
        : red
          ? "Customers can't buy."
          : 'Customers can still buy.',
    openIncident: red
      ? {
          pathId: red.id,
          label: red.label,
          reasonLabel: red.reasonLabel,
        }
      : null,
    lastRecovery: recovered ? { pathId: recovered.id, label: recovered.label } : null,
    emptyCatalog,
    walking,
    paths,
    waitlist: input.waitlist,
    rechecksRemaining: input.rechecksRemaining,
  }
}
