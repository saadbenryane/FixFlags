import { getPublicIssueLibrary } from './queries'
import { rubricLabel } from '@/lib/marketing/issue-page'

export interface RelatedLink {
  type: 'issue' | 'tool' | 'benchmark'
  href: string
  title: string
  reason: string
  siteCount?: number
}

export async function getRelatedIssues(checkId: string): Promise<RelatedLink[]> {
  const issues = await getPublicIssueLibrary()
  const current = issues.find((issue) => issue.checkId === checkId)
  if (!current) return []
  const others = issues.filter((issue) => issue.checkId !== checkId)
  const sameRubric = others.filter((issue) => issue.rubric === current.rubric)
  const sharedFramework = others.filter((issue) => issue.rubric !== current.rubric &&
    issue.topFrameworks.some((framework) => current.topFrameworks.some((other) => other.name === framework.name)))
  return [...sameRubric, ...sharedFramework].slice(0, 3).map((issue) => ({
    type: 'issue',
    href: `/issues/${issue.checkId}`,
    title: issue.problemTemplate,
    reason: issue.rubric === current.rubric ? `Same ${rubricLabel(current.rubric)} rubric` : 'Shared technology stack',
    siteCount: issue.siteCount,
  }))
}
