import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Allowed internal redirect paths after auth callback
const ALLOWED_PREFIXES = ['/auction', '/strategy', '/host', '/join', '/live', '/profile', '/payment', '/reset-password']

function isValidInternalPath(path: string): boolean {
  // Must start with / and not contain protocol or double slashes (prevents //evil.com)
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    return false
  }
  return ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?'))
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/auction'

  // Validate redirect target to prevent open redirect attacks
  const safeNext = isValidInternalPath(next) ? next : '/auction'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
