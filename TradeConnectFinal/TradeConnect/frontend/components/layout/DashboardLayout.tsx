'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

interface NavItem { href: string; label: string }

const EMPLOYER_NAV: NavItem[] = [
  { href: '/employer/dashboard',  label: 'Dashboard' },
  { href: '/employer/post-job',   label: 'Post a Job' },
  { href: '/employer/postings',   label: 'My Postings' },
  { href: '/employer/browse',     label: 'Browse Trades' },
  { href: '/bookings',            label: 'My Bookings' },
  { href: '/notifications',       label: 'Notifications' },
  { href: '/profile',             label: 'Profile' },
]

const TRADESPERSON_NAV: NavItem[] = [
  { href: '/tradesperson/dashboard',     label: 'Dashboard' },
  { href: '/tradesperson/jobs',          label: 'Browse Jobs' },
  { href: '/tradesperson/applications',  label: 'My Applications' },
  { href: '/tradesperson/endorsements',  label: 'Endorsement Inbox' },
  { href: '/bookings',                   label: 'My Bookings' },
  { href: '/tradesperson/subscription',  label: 'Subscription' },
  { href: '/reviews',                    label: 'Reviews' },
  { href: '/notifications',              label: 'Notifications' },
  { href: '/profile',                    label: 'Profile' },
]

const JUNIOR_NAV: NavItem[] = [
  { href: '/junior/dashboard',     label: 'Dashboard' },
  { href: '/junior/setup',         label: 'My Setup' },
  { href: '/junior/jobs',          label: 'Browse Jobs' },
  { href: '/junior/applications',  label: 'My Applications' },
  { href: '/bookings',             label: 'My Bookings' },
  { href: '/notifications',        label: 'Notifications' },
  { href: '/profile',              label: 'Profile' },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/revenue',  label: 'Revenue' },
  { href: '/admin/users',    label: 'Users' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/profile',        label: 'Profile' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  const nav =
    user?.user_type === 'Employer'     ? EMPLOYER_NAV :
    user?.user_type === 'Tradesperson' ? TRADESPERSON_NAV :
    user?.user_type === 'Admin'        ? ADMIN_NAV :
    JUNIOR_NAV

  return (
    <div className="min-h-screen flex bg-cream">
      <aside className="w-64 bg-navy flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-white/10">
          <Link href="/" className="font-display text-2xl text-teal">TradeConnect</Link>
          {user && (
            <p className="text-white/40 text-xs mt-1 truncate">
              {user.first_name} {user.last_name}
            </p>
          )}
          {user && (
            <p className="text-white/30 text-xs">{user.user_type}</p>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 flex flex-col gap-1 overflow-y-auto">
          {nav.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'px-3 py-2.5 rounded-lg text-sm font-medium transition-all ' +
                  (active
                    ? 'bg-teal/20 text-teal'
                    : 'text-white/50 hover:text-white hover:bg-white/5')
                }
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all font-medium"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
