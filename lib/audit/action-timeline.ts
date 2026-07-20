export type ActionTimelineKind =
  | 'navigate'
  | 'click'
  | 'overlay'
  | 'form'
  | 'network'
  | 'journey'
  | 'flow'
  | 'capture'
  | 'info'

export interface ActionTimelineEvent {
  t: number
  kind: ActionTimelineKind
  label: string
  url?: string
  status?: number | string
  screenshot?: string | null
}

const MAX_EVENTS = 80

export function createActionTimeline(startedAt = Date.now()) {
  const events: ActionTimelineEvent[] = []

  function push(
    kind: ActionTimelineKind,
    label: string,
    extra?: Partial<Omit<ActionTimelineEvent, 't' | 'kind' | 'label'>>
  ) {
    if (events.length >= MAX_EVENTS) return
    events.push({
      t: Date.now() - startedAt,
      kind,
      label: label.slice(0, 200),
      ...extra,
    })
  }

  return {
    events,
    push,
    snapshot: () => events.slice(),
  }
}

export type ActionTimeline = ReturnType<typeof createActionTimeline>

export function parseActionTimeline(data: unknown): ActionTimelineEvent[] {
  if (!data || typeof data !== 'object') return []
  const raw = (data as { actionTimeline?: unknown }).actionTimeline
  if (!Array.isArray(raw)) return []
  return raw
    .filter((e): e is ActionTimelineEvent => Boolean(e && typeof e === 'object' && 'label' in e))
    .slice(0, MAX_EVENTS)
}
