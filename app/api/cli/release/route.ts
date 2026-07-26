import { NextResponse } from 'next/server'
import { getCliReleaseAvailability } from '@/lib/cli/release'

export async function GET() {
  return NextResponse.json(await getCliReleaseAvailability())
}
