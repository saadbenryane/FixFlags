export interface FlowDataStep {
  label: string
  screenshotUrl: string | null
  url: string
}

export interface FlowData {
  status: string
  steps: FlowDataStep[]
  finalUrl: string
  ctaText?: string | null
  ctaHref?: string | null
}

export function parseFlowData(raw: unknown): FlowData | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (typeof data.status !== 'string' || typeof data.finalUrl !== 'string') return null
  const steps = Array.isArray(data.steps)
    ? data.steps
        .filter(
          (step): step is FlowDataStep =>
            typeof step === 'object' &&
            step !== null &&
            typeof (step as FlowDataStep).label === 'string' &&
            typeof (step as FlowDataStep).url === 'string'
        )
        .map((step) => ({
          label: step.label,
          url: step.url,
          screenshotUrl:
            typeof step.screenshotUrl === 'string' ? step.screenshotUrl : null,
        }))
    : []
  return {
    status: data.status,
    steps,
    finalUrl: data.finalUrl,
    ctaText: typeof data.ctaText === 'string' ? data.ctaText : null,
    ctaHref: typeof data.ctaHref === 'string' ? data.ctaHref : null,
  }
}
