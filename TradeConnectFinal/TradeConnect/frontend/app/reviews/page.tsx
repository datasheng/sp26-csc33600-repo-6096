'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StarRating } from '@/components/ui/StarRating'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  reviewsApi,
  type EnrichedReviewRequest, type EnrichedReview,
} from '@/lib/api'

export default function ReviewsPage() {
  const [activeTab, setActiveTab]   = useState<'pending' | 'submitted'>('pending')
  const [requests, setRequests]     = useState<EnrichedReviewRequest[]>([])
  const [submittedReviews, setSubmittedReviews] = useState<EnrichedReview[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  // Per-request form state, keyed by review_request_id
  const [forms, setForms]           = useState<Record<number, { rating: number; comment: string }>>({})
  const [submittingId, setSubmittingId] = useState<number | null>(null)

  async function loadAll() {
    setLoading(true); setError('')
    try {
      const [reqs, sub] = await Promise.all([
        reviewsApi.getRequests(),
        reviewsApi.getSubmitted(),
      ])
      setRequests(reqs.requests)
      setSubmittedReviews(sub.reviews)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  function setForm(id: number, patch: Partial<{ rating: number; comment: string }>) {
    setForms(prev => ({
      ...prev,
      [id]: { rating: prev[id]?.rating ?? 0, comment: prev[id]?.comment ?? '', ...patch },
    }))
  }

  async function handleSubmit(req: EnrichedReviewRequest) {
    const f = forms[req.review_request_id]
    if (!f?.rating) return
    setSubmittingId(req.review_request_id)
    try {
      await reviewsApi.submit({
        booking_id: req.booking_id,
        tradesperson_id: req.tradesperson_id,
        rating: f.rating,
        comment: f.comment || undefined,
      })
      // Refetch both lists — the request will move to "submitted"
      await loadAll()
      setActiveTab('submitted')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to submit review')
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-3xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">Reviews</h1>
        <p className="text-brand-muted mb-8">Leave reviews for completed jobs and see your history.</p>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
          {(['pending', 'submitted'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                activeTab === tab ? 'bg-white text-navy shadow-sm' : 'text-brand-muted hover:text-navy'
              }`}>
              {tab}
              {tab === 'pending' && requests.length > 0 && (
                <span className="ml-2 text-xs bg-brand-teal text-white rounded-full px-2 py-0.5">
                  {requests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-brand-muted text-center py-16">Loading…</p>
        ) : error ? (
          <p className="text-red-600 text-center py-16">{error}</p>
        ) : activeTab === 'pending' ? (
          <div className="flex flex-col gap-4">
            {requests.length === 0 ? (
              <p className="text-brand-muted text-center py-16">No pending reviews.</p>
            ) : requests.map(req => {
              const f = forms[req.review_request_id] ?? { rating: 0, comment: '' }
              return (
                <div key={req.review_request_id}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-navy">
                        {req.tradesperson_name || `Tradesperson #${req.tradesperson_id}`}
                      </p>
                      <p className="text-sm text-brand-muted">
                        {req.service_name || `Booking #${req.booking_id}`}
                      </p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-sm text-brand-muted mb-2">Your rating (required, 1–5)</p>
                      <StarRating
                        value={f.rating}
                        onChange={v => setForm(req.review_request_id, { rating: v })}
                        size="lg"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-brand-muted mb-2">Comment (optional)</p>
                      <textarea
                        value={f.comment}
                        onChange={e => setForm(req.review_request_id, { comment: e.target.value })}
                        rows={3}
                        placeholder="How was the job?"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand-teal resize-none"
                      />
                    </div>
                    <button
                      onClick={() => handleSubmit(req)}
                      disabled={!f.rating || submittingId === req.review_request_id}
                      className="px-6 py-3 bg-brand-teal text-white font-semibold rounded-xl text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      {submittingId === req.review_request_id ? 'Submitting…' : 'Submit Review'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {submittedReviews.length === 0 ? (
              <p className="text-brand-muted text-center py-16">No submitted reviews yet.</p>
            ) : submittedReviews.map(r => (
              <div key={r.review_id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-navy">
                    {r.tradesperson_name || `Tradesperson #${r.tradesperson_id}`}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                  </p>
                </div>
                <StarRating value={r.rating} readonly size="sm" />
                {r.comment && <p className="text-sm text-brand-muted mt-3">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
