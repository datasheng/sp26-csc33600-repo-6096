'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StarRating } from '@/components/ui/StarRating'
import type { TradespersonWithUser, Service } from '@/types'
import { tradespeopleApi, servicesApi, bookingsApi } from '@/lib/api'

const TRADE_TYPES = ['All', 'Plumbing', 'Electrical', 'Carpentry', 'HVAC', 'Painting']

type TPCard = TradespersonWithUser & { service_names?: string }

export default function BrowsePage() {
  const [tradeFilter, setTradeFilter] = useState('All')
  const [cityFilter,  setCityFilter]  = useState('')
  const [tps, setTps] = useState<TPCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bookingTp, setBookingTp] = useState<TPCard | null>(null)

  // Initial + filter-change fetch (debounced city)
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true); setError('')
      try {
        const params: { trade_category?: string; city?: string } = {}
        if (tradeFilter !== 'All') params.trade_category = tradeFilter
        if (cityFilter.trim())     params.city           = cityFilter.trim()
        const res = await tradespeopleApi.search(params)
        if (!cancelled) setTps(res.tradespeople)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [tradeFilter, cityFilter])

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">Find a Tradesperson</h1>
        <p className="text-brand-muted mb-8">Browse verified professionals in your area.</p>

        {/* Filters */}
        <div className="flex gap-4 mb-8 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {TRADE_TYPES.map(t => (
              <button key={t} onClick={() => setTradeFilter(t)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  tradeFilter === t
                    ? 'bg-brand-teal text-white border-brand-teal'
                    : 'bg-white text-brand-muted border-gray-200 hover:border-brand-teal'
                }`}>
                {t}
              </button>
            ))}
          </div>
          <input
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            placeholder="Filter by city…"
            className="px-4 py-2 rounded-full border border-gray-200 text-sm bg-white focus:outline-none focus:border-brand-teal"
          />
        </div>

        {/* Cards */}
        {loading ? (
          <p className="text-brand-muted text-center py-16">Loading tradespeople…</p>
        ) : error ? (
          <p className="text-red-600 text-center py-16">{error}</p>
        ) : tps.length === 0 ? (
          <p className="text-brand-muted text-center py-16">No tradespeople match those filters.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tps.map(t => (
              <div key={t.tradesperson_id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-navy text-lg">
                      {t.user.first_name} {t.user.last_name}
                    </h3>
                    <p className="text-brand-muted text-sm">
                      {t.trade_category} · {t.user.city}{t.user.state ? `, ${t.user.state}` : ''}
                    </p>
                  </div>
                  {t.is_verified && (
                    <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold">
                      ✓ Verified
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <StarRating value={Math.round(t.avg_rating)} readonly size="sm" />
                  <span className="text-sm text-brand-muted">{t.avg_rating.toFixed(1)}</span>
                </div>

                {t.service_names && (
                  <p className="text-sm text-brand-muted mb-4">{t.service_names}</p>
                )}
                <p className="text-xs text-brand-muted mb-4">{t.experience_year} yrs experience</p>

                <button
                  onClick={() => setBookingTp(t)}
                  className="w-full py-2.5 rounded-xl bg-brand-navy text-white text-sm font-semibold hover:bg-brand-steel transition-colors">
                  Book now
                </button>
              </div>
            ))}
          </div>
        )}

        {bookingTp && <BookingModal tp={bookingTp} onClose={() => setBookingTp(null)} />}
      </div>
    </DashboardLayout>
  )
}

// ── Booking modal ────────────────────────────────────────────
function BookingModal({ tp, onClose }: { tp: TPCard; onClose: () => void }) {
  const [services, setServices] = useState<Service[]>([])
  const [serviceId, setServiceId] = useState<number | ''>('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [city, setCity] = useState(tp.user.city ?? '')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    servicesApi.getForTradesperson(tp.tradesperson_id)
      .then(r => {
        setServices(r.services)
        if (r.services[0]) setServiceId(r.services[0].service_id)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load services'))
  }, [tp.tradesperson_id])

  async function handleBook() {
    if (!serviceId || !scheduledAt) return
    setSubmitting(true); setError('')
    try {
      await bookingsApi.create({
        tradesperson_id: tp.tradesperson_id,
        service_id: Number(serviceId),
        scheduled_at: scheduledAt.replace('T', ' ') + ':00',
        city, address,
      })
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to book')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h2 className="font-display text-xl text-navy mb-1">Book {tp.user.first_name} {tp.user.last_name}</h2>
        <p className="text-brand-muted text-sm mb-5">{tp.trade_category}</p>

        {success ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">✓</p>
            <p className="font-semibold text-green-700">Booking request sent!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-brand-muted uppercase tracking-wide">Service</label>
              <select
                value={serviceId}
                onChange={e => setServiceId(e.target.value ? Number(e.target.value) : '')}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-teal">
                <option value="">— Select a service —</option>
                {services.map(s => (
                  <option key={s.service_id} value={s.service_id}>
                    {s.service_name}{s.hourly_rate ? ` ($${s.hourly_rate}/hr)` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-brand-muted uppercase tracking-wide">Scheduled at</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-teal" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-brand-muted uppercase tracking-wide">City</label>
                <input value={city} onChange={e => setCity(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-teal" />
              </div>
              <div>
                <label className="text-xs text-brand-muted uppercase tracking-wide">Address</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="123 Main St"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-teal" />
              </div>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3 mt-2">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-navy text-sm font-semibold hover:border-brand-teal transition-colors">
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={!serviceId || !scheduledAt || submitting}
                className="flex-1 py-2.5 rounded-lg bg-brand-teal text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity">
                {submitting ? 'Booking…' : 'Confirm booking'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
