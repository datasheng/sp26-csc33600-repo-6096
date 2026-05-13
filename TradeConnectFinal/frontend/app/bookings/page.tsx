'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { BookingStatus } from '@/types'
import { bookingsApi, paymentsApi, type EnrichedBooking } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

const ALL_STATUSES: BookingStatus[] = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled']

export default function BookingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [bookings, setBookings] = useState<EnrichedBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payingId, setPayingId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    bookingsApi.getAll()
      .then(r => setBookings(r.bookings))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = bookings.filter(b => statusFilter === 'all' || b.status === statusFilter)

  async function refresh() {
    const r = await bookingsApi.getAll()
    setBookings(r.bookings)
  }

  async function handleStatusChange(b: EnrichedBooking, status: BookingStatus) {
    setBusyId(b.booking_id)
    try {
      await bookingsApi.updateStatus(b.booking_id, status)
      await refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Status update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handlePay(b: EnrichedBooking) {
    if (b.quoted_price == null) {
      alert('No price set for this booking.')
      return
    }
    setPayingId(b.booking_id)
    try {
      await paymentsApi.create({
        booking_id: b.booking_id,
        amount: Number(b.quoted_price),
        method: 'card',
      })
      await refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Payment failed')
    } finally {
      setPayingId(null)
    }
  }

  const isEmployer = user?.user_type === 'Employer'
  const isTrade    = user?.user_type === 'Tradesperson' || user?.user_type === 'Junior'

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">My Bookings</h1>
        <p className="text-brand-muted mb-8">Track all your job bookings and their status.</p>

        {/* Status filter pills */}
        <div className="flex gap-2 flex-wrap mb-8">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
              statusFilter === 'all' ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-brand-muted border-gray-200 hover:border-brand-navy'
            }`}>
            All
          </button>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border capitalize transition-all ${
                statusFilter === s ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-brand-muted border-gray-200 hover:border-brand-navy'
              }`}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Bookings list */}
        {loading ? (
          <p className="text-brand-muted text-center py-16">Loading…</p>
        ) : error ? (
          <p className="text-red-600 text-center py-16">{error}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.length === 0 && (
              <p className="text-brand-muted text-center py-16">No bookings found.</p>
            )}
            {filtered.map(b => {
              const otherParty = isEmployer ? b.tradesperson_name : b.employer_name
              const quoted = b.quoted_price != null ? Number(b.quoted_price) : null
              const estimatedFee = quoted != null ? quoted * 0.10 : null
              const estimatedPayout = quoted != null ? quoted - estimatedFee! : null
              const fee = b.platform_fee_amount ?? estimatedFee
              const payout = b.tradesperson_payout ?? estimatedPayout
              return (
                <div key={b.booking_id}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-navy text-lg">{b.service_name}</h3>
                      <p className="text-sm text-brand-muted mt-0.5">With {otherParty}</p>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-brand-muted text-xs uppercase tracking-wide mb-0.5">Scheduled</p>
                      <p className="text-navy font-medium">
                        {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString() : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-brand-muted text-xs uppercase tracking-wide mb-0.5">Location</p>
                      <p className="text-navy font-medium">
                        {b.address ? `${b.address}${b.city ? ', ' + b.city : ''}` : (b.city || '—')}
                      </p>
                    </div>
                    <div>
                      <p className="text-brand-muted text-xs uppercase tracking-wide mb-0.5">Quoted Price</p>
                      <p className="text-navy font-semibold">
                        {quoted != null ? `$${quoted.toFixed(2)}` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-brand-muted text-xs uppercase tracking-wide mb-0.5">Platform Fee</p>
                      <p className="text-navy font-semibold">
                        {fee != null ? `$${Number(fee).toFixed(2)}` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-brand-muted text-xs uppercase tracking-wide mb-0.5">Tradesperson Payout</p>
                      <p className="text-navy font-semibold">
                        {payout != null ? `$${Number(payout).toFixed(2)}` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-brand-muted">Payment:</span>
                      <StatusBadge status={(b.payment_status || 'pending') as 'pending' | 'paid' | 'failed'} />
                      {quoted != null && (
                        <span className="text-xs text-brand-muted">
                          10% platform fee = ${Number(fee || 0).toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {/* Tradesperson actions */}
                      {isTrade && b.status === 'pending' && (
                        <button
                          disabled={busyId === b.booking_id}
                          onClick={() => handleStatusChange(b, 'accepted')}
                          className="px-4 py-2 bg-brand-teal text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity">
                          Accept
                        </button>
                      )}
                      {isTrade && b.status === 'accepted' && (
                        <button
                          disabled={busyId === b.booking_id}
                          onClick={() => handleStatusChange(b, 'in_progress')}
                          className="px-4 py-2 bg-brand-teal text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity">
                          Start work
                        </button>
                      )}
                      {isTrade && b.status === 'in_progress' && (
                        <button
                          disabled={busyId === b.booking_id}
                          onClick={() => handleStatusChange(b, 'completed')}
                          className="px-4 py-2 bg-brand-teal text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity">
                          Mark complete
                        </button>
                      )}

                      {/* Employer actions */}
                      {isEmployer && b.status === 'completed' && b.payment_status !== 'paid' && (
                        <button
                          disabled={payingId === b.booking_id}
                          onClick={() => handlePay(b)}
                          className="px-4 py-2 bg-brand-teal text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity">
                          {payingId === b.booking_id ? 'Paying…' : 'Pay now'}
                        </button>
                      )}
                      {isEmployer && b.status === 'completed' && !b.has_review && (
                        <button
                          onClick={() => router.push('/reviews')}
                          className="px-4 py-2 border border-gray-200 text-navy text-xs font-semibold rounded-lg hover:border-brand-teal transition-colors">
                          Leave a review
                        </button>
                      )}

                      {/* Cancel — both sides for active bookings */}
                      {(b.status === 'pending' || b.status === 'accepted') && (
                        <button
                          disabled={busyId === b.booking_id}
                          onClick={() => handleStatusChange(b, 'cancelled')}
                          className="px-4 py-2 border border-gray-200 text-red-600 text-xs font-semibold rounded-lg hover:border-red-400 disabled:opacity-40 transition-colors">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
