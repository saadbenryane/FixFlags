import { requireAdmin,isAdminResponse } from '@/lib/auth/require-admin'
import { apiError } from '@/lib/api/errors'
export async function GET(){const actor=await requireAdmin();if(isAdminResponse(actor))return actor;return apiError('Authorize this download through the admin workspace.',409)}
