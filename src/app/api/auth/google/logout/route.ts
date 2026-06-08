import { NextResponse } from 'next/server'
import { clearGoogleSession } from '@/lib/google/session'

export const dynamic = 'force-dynamic'

export async function POST() {
  await clearGoogleSession()
  return NextResponse.json({ ok: true })
}
