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
    if (user && (path === '/login' || path === '/register')) {
      const url = request.nextUrl.clone()
      url.pathname = '/auction'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Allow specific API routes — they handle their own auth.
  // SECURITY: Allowlist only known prefixes, not blanket /api/
  if (path.startsWith('/api/webhooks') || path.startsWith('/api/test-') || path.startsWith('/api/espn')) {
    return supabaseResponse
  }

  // Everything below requires authentication
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
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
