import { overlayObservationSchema } from '@/lib/audit/checks/overlay-evidence'

/** Match the image to a measured control in the exact source scan. */
export function recordedOverlayCapture(input: { artifact: unknown; auditId: string; pageUrl: string; targets: unknown }) {
  const artifact = input.artifact as { data?: { observation?: unknown } } | null
  const parsed = overlayObservationSchema.safeParse(artifact?.data?.observation)
  if (!parsed.success || parsed.data.restricted || !parsed.data.contentVisible || parsed.data.scope.pageUrl !== input.pageUrl) return null
  const observation = parsed.data, capture = observation.capture
  if (!capture || !Array.isArray(input.targets) || !input.targets.some(target => target && typeof target === 'object' &&
    target.context === capture.context && target.device === observation.device && target.source === 'measured')) return null
  if (!observation.controls.some(control => control.context === capture.context && control.disposition === 'failed')) return null
  try {
    const url = new URL(capture.url, 'https://fixflags.com')
    if (url.pathname !== `/api/screenshots/${input.auditId}/${observation.device}` || !url.searchParams.get('page')?.startsWith('overlay-')) return null
    return { url: `${url.pathname}${url.search}`, recordedAt: capture.recordedAt }
  } catch { return null }
}
