import type { RubricName, ImpactTagName, SeverityName } from '../constants'
import { DeterministicFlag } from './index'

export interface CheckContext {
  url: string
  metadata: Record<string, unknown>
  consoleErrors?: string[]
  captureMetrics?: Record<string, unknown> | null
  flowResult?: Record<string, unknown> | null
  slowReplayResult?: Record<string, unknown> | null
  pageSpeedDesktop?: Record<string, unknown> | null
  pageSpeedMobile?: Record<string, unknown> | null
}

export interface CheckDescriptor {
  id: string
  rubric: RubricName
  impactTag?: ImpactTagName
  severity: SeverityName
  tags: string[]
  evaluate(ctx: CheckContext): DeterministicFlag | DeterministicFlag[] | null
  messageKey?: string
}

const registry = new Map<string, CheckDescriptor>()

export function registerCheck(descriptor: CheckDescriptor): void {
  if (registry.has(descriptor.id)) {
    throw new Error(`Duplicate check registration: ${descriptor.id}`)
  }
  registry.set(descriptor.id, descriptor)
}

export function getCheck(id: string): CheckDescriptor | undefined {
  return registry.get(id)
}

export function getAllChecks(): CheckDescriptor[] {
  return [...registry.values()]
}

export function getChecksByTag(tag: string): CheckDescriptor[] {
  return getAllChecks().filter((c) => c.tags.includes(tag))
}
