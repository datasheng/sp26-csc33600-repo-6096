import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Pages that require login
const PROTECTED = [
  '/employer',
  '/tradesperson',
  '/junior',
  '/admin',
  '/bookings',
  '/reviews',
  '/notifications',
  '/profile',
]

// Pages only accessible when NOT logged in
const AUTH_ONLY = ['/login', '/register']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // We use a cookie set by Flask session (session cookie name is typically 'session')
  // For a more robust check, you can validate with a dedicated /api/auth/me endpoint
  const hasSession = req.cookies.has('session')

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  const isAuthOnly  = AUTH_ONLY.some(p => pathname.startsWith(p))

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isAuthOnly && hasSession) {
    // Redirect to home if already logged in and trying to access login/register
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
