import { prisma } from '@/lib/db'
import { agentCitationSchema, type AgentCitation } from '@/lib/sites/agent-contract'

/** Stored references are untrusted; resolve their ownership and rebuild local destinations. */
export async function authorizeAgentCitations(projectId: string, values: unknown[]) {
  const parsed = values.flatMap(value => Array.isArray(value) ? value.flatMap(item => {
    const citation = agentCitationSchema.safeParse(item)
    return citation.success ? [citation.data] : []
  }) : [])
  const ids = [...new Set(parsed.map(citation => citation.id))]
  const [improvements, flags, attempts] = ids.length ? await Promise.all([
    prisma.improvement.findMany({ where: { projectId, id: { in: ids } }, select: { id: true } }),
    prisma.flag.findMany({ where: { audit: { projectId }, id: { in: ids } }, select: { id: true } }),
    prisma.improvementAttempt.findMany({ where: { id: { in: ids }, improvement: { projectId } }, select: { id: true, improvementId: true } }),
  ]) : [[], [], []]
  const flagsAllowed = new Set([...improvements, ...flags].map(flag => flag.id))
  const attemptsAllowed = new Map(attempts.map(attempt => [attempt.id, attempt.improvementId]))
  return (value: unknown): AgentCitation[] => Array.isArray(value) ? value.flatMap(item => {
    const parsed = agentCitationSchema.safeParse(item)
    if (!parsed.success) return []
    const citation = parsed.data
    if (citation.type === 'flag' && flagsAllowed.has(citation.id)) return [{ ...citation, href: `/sites/${projectId}/flags/${citation.id}` }]
    if (citation.type === 'attempt' && attemptsAllowed.has(citation.id)) return [{ ...citation,
      href: `/sites/${projectId}/flags/${attemptsAllowed.get(citation.id)}#attempt-${citation.id}` }]
    if (citation.type === 'watch' && citation.id === projectId) return [{ ...citation, href: `/sites/${projectId}?view=monitoring#monitoring` }]
    return []
  }) : []
}
