'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StarRating } from '@/components/ui/StarRating'
import Link from 'next/link'
import {
  bookingsApi, tradespeopleApi, reviewsApi,
  type EnrichedBooking, type EnrichedReview,
} from '@/lib/api'
import type { TradespersonWithUser } from '@/types'

export default function TradespersonDashboard() {
  const [bookings, setBookings] = useState<EnrichedBooking[]>([])
  const [tp, setTp] = useState<TradespersonWithUser | null>(null)
  const [reviews, setReviews] = useState<EnrichedReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const me = await tradespeopleApi.getMe()
        setTp(me.tradesperson)
        const [b, r] = await Promise.all([
          bookingsApi.getAll(),
          reviewsApi.getForTradesperson(me.tradesperson.tradesperson_id),
        ])
        setBookings(b.bookings)
        setReviews(r.reviews)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const active    = bookings.filter(b => ['pending','accepted','in_progress'].includes(b.status)).length
  const completed = bookings.filter(b => b.status === 'completed').length
  const earned    = bookings
    .filter(b => b.payment_status === 'paid')
    .reduce((sum, b) => sum + (b.tradesperson_payout ?? b.payment_amount ?? b.quoted_price ?? 0), 0)
  const avgRating = tp?.avg_rating ?? 0
  const reviewCount = reviews.length

  const stats = [
    { label: 'Active Jobs',  value: String(active) },
    { label: 'Completed',    value: String(completed) },
    { label: 'Avg Rating',   value: avgRating > 0 ? avgRating.toFixed(1) : '—' },
    { label: 'Net Earned',   value: `$${earned.toFixed(0)}` },
  ]

  const recent = bookings.slice(0, 5)

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">Your Dashboard</h1>
        <p className="text-brand-muted mb-8">Here&apos;s an overview of your work.</p>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-2xl font-display text-navy">{s.value}</p>
              <p className="text-sm text-brand-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Rating summary */}
        {reviewCount > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8 flex items-center gap-6">
            <div>
              <p className="text-5xl font-display text-navy">{avgRating.toFixed(1)}</p>
              <p className="text-sm text-brand-muted mt-1">Average rating</p>
            </div>
            <div>
              <StarRating value={Math.round(avgRating)} readonly size="lg" />
              <p className="text-sm text-brand-muted mt-2">
                Based on {reviewCount} review{reviewCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex gap-3 mb-10">
          <Link href="/tradesperson/jobs"
            className="px-5 py-3 rounded-xl bg-brand-teal text-white font-semibold text-sm hover:opacity-90 transition-opacity">
            Browse Available Jobs
          </Link>
          <Link href="/reviews"
            className="px-5 py-3 rounded-xl bg-white border border-gray-200 text-navy font-semibold text-sm hover:border-brand-teal transition-colors">
            View My Reviews
          </Link>
          <Link href="/tradesperson/subscription"
            className="px-5 py-3 rounded-xl bg-white border border-gray-200 text-navy font-semibold text-sm hover:border-brand-teal transition-colors">
            Manage Subscription
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
              You don&apos;t have any bookings yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {recent.map(b => (
                <div key={b.booking_id}
                  className="bg-white rounded-xl px-6 py-4 shadow-sm border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-navy">{b.service_name}</p>
                    <p className="text-sm text-brand-muted">
                      {b.employer_name} ·{' '}
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
