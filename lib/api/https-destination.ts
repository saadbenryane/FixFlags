import { z } from 'zod'

/** A server-supplied external destination must remain HTTPS and contain no embedded credentials. */
export const httpsDestinationSchema = z.url().refine(value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
})

export const httpsDestinationReceipt = z.object({ url: httpsDestinationSchema })
