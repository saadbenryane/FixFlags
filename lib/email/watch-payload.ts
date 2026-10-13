import { z } from 'zod'

/** The complete provider body stays stable across retries and deployments. */
export const watchEmailPayloadSchema = z.object({
  version: z.literal(1), from: z.string().min(1), to: z.string().email(),
  subject: z.string().min(1), html: z.string().min(1), text: z.string().min(1),
  tags: z.array(z.object({ name: z.string(), value: z.string() }).strict()).max(10),
}).strict()
