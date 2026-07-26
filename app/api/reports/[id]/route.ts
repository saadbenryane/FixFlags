import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { getGatedAuditForRequest } from '@/lib/audit/fetch-audit'
import { buildUnifiedFixList } from '@/lib/audit/load-finish-plan-flags'
import { RUBRIC_ORDER } from '@/lib/audit/constants'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await getGatedAuditForRequest(id)

    if (result.kind === 'not_found') {
      return apiError('Report not found', 404)
    }

    if (result.kind === 'forbidden') {
      return apiError('You do not have access to this report', 403)
    }

    const fixList = await buildUnifiedFixList({
      userId: result.audit.userId,
      auditUrl: result.audit.url,
      flags: result.audit.flags,
      rubricRows: result.audit.rubrics.map((rubric) => ({
        name: rubric.name,
        grade: rubric.grade ?? null,
      })),
      contract: result.audit.productContract,
      promptAccess: result.showDeterministicFixes
        ? 'all'
        : result.sampleFixFlag
          ? 'one'
          : 'none',
      demonstratedFlag: result.sampleFixFlag,
    })
    const countsByRubric = new Map(
      RUBRIC_ORDER.map((rubric) => [
        rubric,
        fixList.items.filter((flag) => flag.rubricName === rubric),
      ])
    )
    const { flags: _rawFlags, rubrics: rawRubrics, ...report } = result.audit
    void _rawFlags
    const rubrics = rawRubrics.map((rubric) => {
      const { flags: _occurrences, ...rubricSummary } = rubric as typeof rubric & {
        flags?: unknown
      }
      void _occurrences
      const flags = countsByRubric.get(rubric.name as (typeof RUBRIC_ORDER)[number]) ?? []
      return {
        ...rubricSummary,
        flagCount: flags.length,
        criticalCount: flags.filter((flag) => flag.severity === 'CRITICAL').length,
        importantCount: flags.filter((flag) => flag.severity === 'IMPORTANT').length,
      }
    })
    const response = NextResponse.json({ ...report, rubrics, fixList })
    if (result.audit.isPublic && !result.showDeterministicFixes) {
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300')
    }
    return response
  } catch (err) {
    return handleRouteError(err)
  }
}
