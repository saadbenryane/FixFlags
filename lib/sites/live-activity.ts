import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

type Task = { kind: string; pageUrl: string; state: string; device?: 'desktop' | 'mobile' | null }
const NOW = SITE_ACTION_COPY.execution.now

function pathOf(url: string) {
  try { return new URL(url).pathname || '/' } catch { return url || '/' }
}

/** One plain sentence about what the check is trying right now, or null when nothing is running. */
export function liveActivityLine(tasks: readonly Task[] | null | undefined): string | null {
  const running = (tasks ?? []).filter(task => task.state === 'RUNNING')
  if (running.length === 0) return null
  const [first] = running
  const describe = (NOW as unknown as Record<string, ((page: string) => string) | undefined>)[first.kind] ?? NOW.other
  const sentence = first.device ? NOW.device(describe(pathOf(first.pageUrl)), first.device) : describe(pathOf(first.pageUrl))
  return running.length > 1 ? `${sentence}, ${NOW.more(running.length - 1)}` : sentence
}
