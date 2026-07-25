import type { RubricName, ImpactTagName, SeverityName } from '../constants'

export interface CheckDescriptor {
  id: string
  rubric: RubricName
  impactTag?: ImpactTagName
  severity: SeverityName
  tags: string[]
  requiresBrowser?: boolean
  criticalPathConcurrency?: number
}

const registry = new Map<string, CheckDescriptor>()

export function registerCheck(descriptor: CheckDescriptor): void {
  if (registry.has(descriptor.id)) {
    throw new Error(`Duplicate check registration: ${descriptor.id}`)
  }
  registry.set(descriptor.id, descriptor)
}
