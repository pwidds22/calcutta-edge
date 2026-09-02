import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const publicRoutes = ['/', '/login', '/register', '/auth/callback', '/forgot-password', '/reset-password', '/events', '/blog']
const paidRoutes: string[] = []

export async function middleware(request: NextRequest) {
  const { user, supabase, supabaseResponse } = await updateSession(request)
  const path = request.nextUrl.pathname

  // Allow public routes (exact match or prefix match for /blog/*)
  const isPublic = publicRoutes.includes(path) || path.startsWith('/blog/')
  if (isPublic) {
    // Signed-in visitors don't need the auth pages — but a `next` on them is a
    // real destination, so let the page handle the redirect rather than
    // bouncing to /dashboard here and dropping it.
    if (user && (path === '/login' || path === '/register') && !request.nextUrl.searchParams.has('next')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Allow specific API routes — they handle their own auth.
  // SECURITY: Allowlist only known prefixes, not blanket /api/
  if (path.startsWith('/api/webhooks') || path.startsWith('/api/test-') || path.startsWith('/api/espn') || path.startsWith('/api/golf') || path.startsWith('/api/soccer') || path.startsWith('/api/nfl') || path.startsWith('/api/worldcup') || path.startsWith('/ingest')) {
    return supabaseResponse
  }

  // Everything below requires authentication
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Remember where they were going. Without this, a deep link from an email
    // (e.g. /host/create?tournament=nfl_season_2026) is silently downgraded to
    // a generic dashboard landing the moment the visitor is signed out.
    // `search` is carried too, so the tournament choice survives; the login and
    // signup actions re-validate it with `safeNext` before redirecting.
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`
    return NextResponse.redirect(url)
  }

  // For paid routes, check has_paid in profiles table
  if (paidRoutes.some((route) => path.startsWith(route))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('has_paid')
      .eq('id', user.id)
      .single()

    if (!profile?.has_paid) {
      const url = request.nextUrl.clone()
      url.pathname = '/payment'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
