import { type NextRequest } from 'next/server'
import { POST as waitlistPost } from '@/app/api/stripe/waitlist/route'

/** Legacy alias for `/api/stripe/waitlist`. */
export async function POST(req: NextRequest) {
  return waitlistPost(req)
}
