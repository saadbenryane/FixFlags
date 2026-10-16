import { randomUUID } from 'node:crypto'

const PATH = /^path-([a-zA-Z0-9]+)-\d+(?:-[a-f0-9]{32})?$/
const OUTCOME = /^outcome-([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}|[a-zA-Z0-9]+)-[a-zA-Z0-9_-]+$/

export function newPathArtifactNamespace(pathId: string): string {
  if (!/^[a-zA-Z0-9]+$/.test(pathId)) throw new Error('A canonical integrity path ID is required')
  return `path-${pathId}-${Date.now()}-${randomUUID().replaceAll('-', '')}`
}

/** Readers and cleanup share the producer's ownership protocol, including history. */
export function pathIdForArtifactNamespace(namespace: string): string | null { return namespace.match(PATH)?.[1] ?? null }
export function outcomeRequestIdForArtifactNamespace(namespace: string): string | null { return namespace.match(OUTCOME)?.[1] ?? null }
