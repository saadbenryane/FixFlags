import { z } from 'zod'
import { httpsDestinationSchema } from '@/lib/api/https-destination'

export const authorizationReceipt = z.object({
  redirect: z.literal(false),
  url: httpsDestinationSchema,
})
