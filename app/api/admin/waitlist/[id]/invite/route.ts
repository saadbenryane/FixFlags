import { apiError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
export async function POST() {
  const actor = await requireAdmin()
  if (isAdminResponse(actor)) return actor
  return apiError('Review and confirm this action through the admin action service.', 409)
}
