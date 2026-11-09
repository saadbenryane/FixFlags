export type ResearchIndependenceSource = { hostname: string; ownerId: string }

/** Group the full sample before counting any cell. A shared owner or hostname
 * links records transitively, even when the linking audit is outside a cell. */
export function researchIndependenceGroups(sources: ReadonlyMap<string, ResearchIndependenceSource>) {
  const parents = new Map<string, string>()
  function root(key: string) {
    let current = key
    while (parents.has(current)) {
      const parent = parents.get(current)!
      const grandparent = parents.get(parent)
      if (grandparent) parents.set(current, grandparent)
      current = parent
    }
    return current
  }
  for (const { hostname, ownerId } of sources.values()) {
    const host = root(`host:${hostname}`)
    const owner = root(`owner:${ownerId}`)
    if (host !== owner) parents.set(host, owner)
  }
  return new Map([...sources].map(([auditId, source]) => [auditId, root(`host:${source.hostname}`)]))
}

export function countResearchGroups(auditIds: Iterable<string>, groups: ReadonlyMap<string, string>) {
  const distinct = new Set<string>()
  for (const id of auditIds) {
    const group = groups.get(id)
    if (group !== undefined) distinct.add(group)
  }
  return distinct.size
}
