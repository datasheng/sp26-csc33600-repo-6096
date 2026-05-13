'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'
import { bookingsApi, reviewsApi, type EnrichedBooking } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

export default function EmployerDashboard() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<EnrichedBooking[]>([])
  const [pendingReviews, setPendingReviews] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([bookingsApi.getAll(), reviewsApi.getRequests()])
      .then(([b, r]) => {
        setBookings(b.bookings)
        setPendingReviews(r.requests.length)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const active    = bookings.filter(b => ['pending','accepted','in_progress'].includes(b.status)).length
  const completed = bookings.filter(b => b.status === 'completed').length
  const totalSpent = bookings
    .filter(b => b.payment_status === 'paid')
    .reduce((sum, b) => sum + (b.payment_amount ?? b.quoted_price ?? 0), 0)

  const stats = [
    { label: 'Active Bookings', value: String(active) },
    { label: 'Completed Jobs',  value: String(completed) },
    { label: 'Pending Reviews', value: String(pendingReviews) },
    { label: 'Total Spent',     value: `$${totalSpent.toFixed(0)}` },
  ]

  const recent = bookings.slice(0, 5)

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">
          Good morning{user ? `, ${user.first_name}` : ''} 👋
        </h1>
        <p className="text-brand-muted mb-8">Here&apos;s what&apos;s happening with your jobs.</p>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-2xl font-display text-navy">{s.value}</p>
              <p className="text-sm text-brand-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex gap-3 mb-10 flex-wrap">
          <Link href="/employer/post-job"
            className="px-5 py-3 rounded-xl bg-brand-teal text-white font-semibold text-sm hover:opacity-90 transition-opacity">
            + Post a Job
          </Link>
          <Link href="/employer/postings"
            className="px-5 py-3 rounded-xl bg-white border border-gray-200 text-navy font-semibold text-sm hover:border-brand-teal transition-colors">
            My Postings
          </Link>
          <Link href="/employer/browse"
            className="px-5 py-3 rounded-xl bg-white border border-gray-200 text-navy font-semibold text-sm hover:border-brand-teal transition-colors">
            Browse Tradespeople
          </Link>
          <Link href="/bookings"
            className="px-5 py-3 rounded-xl bg-white border border-gray-200 text-navy font-semibold text-sm hover:border-brand-teal transition-colors">
            View All Bookings
          </Link>
        </div>

        {/* Recent bookings */}
        <section>
          <h2 className="font-display text-xl text-navy mb-4">Recent Bookings</h2>
          {loading ? (
            <p className="text-brand-muted text-center py-12">Loading…</p>
          ) : error ? (
            <p className="text-red-600 text-center py-12">{error}</p>
          ) : recent.length === 0 ? (
            <p className="text-brand-muted text-center py-12">
              You haven&apos;t booked any tradespeople yet.{' '}
              <Link href="/employer/browse" className="text-brand-teal hover:underline">
                Browse now →
              </Link>
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {recent.map(b => (
                <div key={b.booking_id}
                  className="bg-white rounded-xl px-6 py-4 shadow-sm border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-navy">{b.service_name}</p>
                    <p className="text-sm text-brand-muted">
                      {b.tradesperson_name} ·{' '}
                      {b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {b.quoted_price != null && (
                      <span className="font-semibold text-navy">${Number(b.quoted_price).toFixed(0)}</span>
                    )}
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  )
}
