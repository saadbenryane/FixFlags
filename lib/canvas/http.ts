import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api/errors'
import type { CanvasReportAccess } from '@/lib/canvas/access'

export function canvasAccessError(access: Extract<CanvasReportAccess, { allowed: false }>): NextResponse {
  switch (access.reason) {
    case 'REPORT_NOT_FOUND': return apiError('Report not found', 404)
    case 'AUTH_REQUIRED': return apiError('Sign in to use Canvas', 401, { code: 'UNAUTHORIZED' })
    case 'OWNER_REQUIRED': return apiError('Canvas is private to the report owner', 403, { code: 'FORBIDDEN' })
    case 'PAID_PLAN_REQUIRED': return apiError('Canvas requires Pro or Studio', 402, { code: 'UPGRADE_REQUIRED', action: 'upgrade' })
    case 'PROJECT_REQUIRED': return apiError('This report is not attached to a Product', 409, { code: 'PROJECT_REQUIRED' })
  }
  return apiError('Canvas access denied', 403, { code: 'FORBIDDEN' })
}

export function canvasGenerationUnavailable() {
  return apiError('Canvas generation is not configured yet. Your report was not changed.', 503, {
    code: 'CANVAS_GENERATION_UNAVAILABLE',
    action: 'retry',
  })
}
