'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { StarRating } from '@/components/ui/StarRating'
import { jobPostingsApi, jobApplicationsApi } from '@/lib/api'
import type { JobPosting, JobApplication } from '@/types'

export default function PostingDetailPage() {
  const params  = useParams<{ id: string }>()
  const router  = useRouter()
  const id      = Number(params.id)

  const [posting, setPosting]         = useState<JobPosting | null>(null)
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [busyAppId, setBusyAppId]     = useState<number | null>(null)
  const [busyPosting, setBusyPosting] = useState(false)

  const refresh = useCallback(async () => {
    setError('')
    try {
      const r = await jobPostingsApi.get(id)
      setPosting(r.posting)
      setApplications(r.applications ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [id, refresh])

  async function handleDecide(appId: number, decision: 'accept' | 'reject') {
    setBusyAppId(appId)
    try {
      const r = await jobApplicationsApi.decide(appId, decision)
      if (decision === 'accept' && r.booking_id) {
        alert('Accepted. A booking has been created (booking #' + r.booking_id + ').')
        router.push('/bookings')
        return
      }
      await refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to ' + decision)
    } finally {
      setBusyAppId(null)
    }
  }

  async function handleClose() {
    if (!confirm('Close this posting? All pending applications will be rejected.')) return
    setBusyPosting(true)
    try {
      await jobPostingsApi.close(id)
      await refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to close')
    } finally {
      setBusyPosting(false)
    }
  }

  async function handleCancel() {
    if (!confirm('Cancel this posting? All pending applications will be rejected.')) return
    setBusyPosting(true)
    try {
      await jobPostingsApi.cancel(id)
      await refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to cancel')
    } finally {
      setBusyPosting(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 text-muted text-center">Loading...</div>
      </DashboardLayout>
    )
  }

  if (error || !posting) {
    return (
      <DashboardLayout>
        <div className="p-8 max-w-3xl mx-auto">
          <p className="text-red-600 text-center py-16">{error || 'Posting not found'}</p>
          <div className="text-center">
            <Link href="/employer/postings" className="text-teal hover:underline">
              Back to My Postings
            </Link>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const isOpen = posting.status === 'open'

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto animate-fade-up">
        <Link href="/employer/postings" className="text-teal text-sm hover:underline mb-4 inline-block">
          &larr; Back to My Postings
        </Link>

        {/* Posting card */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl text-navy mb-1">{posting.title}</h1>
              <p className="text-sm text-muted">
                {posting.trade_type}
                {posting.city ? ' / ' + posting.city : ''}
                {posting.scheduled_at ? ' / ' + new Date(posting.scheduled_at).toLocaleString() : ''}
              </p>
            </div>
            <StatusBadge status={posting.status} />
          </div>

          {posting.description && (
            <p className="text-sm text-navy/80 mb-4 whitespace-pre-wrap">{posting.description}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {posting.address && (
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-0.5">Address</p>
                <p className="text-navy font-medium">{posting.address}</p>
              </div>
            )}
            {(posting.budget_min != null || posting.budget_max != null) && (
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-0.5">Budget</p>
                <p className="text-navy font-semibold">
                  {posting.budget_min != null ? '$' + posting.budget_min : ''}
                  {posting.budget_max != null ? ' - $' + posting.budget_max : ''}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-0.5">Applications</p>
              <p className="text-navy font-semibold">{applications.length}</p>
            </div>
          </div>

          {isOpen && (
            <div className="mt-6 pt-6 border-t border-gray-100 flex gap-2 flex-wrap">
              <button
                onClick={handleClose}
                disabled={busyPosting}
                className="px-4 py-2 border border-gray-200 text-navy text-sm font-semibold rounded-lg hover:border-teal disabled:opacity-40 transition-colors"
              >
                Close posting
              </button>
              <button
                onClick={handleCancel}
                disabled={busyPosting}
                className="px-4 py-2 border border-gray-200 text-red-600 text-sm font-semibold rounded-lg hover:border-red-400 disabled:opacity-40 transition-colors"
              >
                Cancel posting
              </button>
            </div>
          )}
        </section>

        {/* Applications */}
        <h2 className="font-display text-xl text-navy mb-4">Applications</h2>

        {applications.length === 0 ? (
          <p className="text-muted text-center py-12">
            No applications yet. Tradespeople in this trade can apply.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {applications.map(a => (
              <div
                key={a.application_id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between mb-3 gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-navy">{a.tradesperson_name}</h3>
                      {a.is_verified && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <StarRating value={Math.round(a.avg_rating ?? 0)} readonly size="sm" />
                      <span className="text-xs text-muted">
                        {a.avg_rating != null ? a.avg_rating.toFixed(1) : '-'}
                      </span>
                      <span className="text-xs text-muted">/ {a.trade_category}</span>
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>

                {a.service_name && (
                  <p className="text-sm text-muted mb-1">
                    Offering: <span className="text-navy font-medium">{a.service_name}</span>
                  </p>
                )}
                {a.message && (
                  <p className="text-sm text-navy/80 mb-3 whitespace-pre-wrap">{a.message}</p>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wide">Proposed price</p>
                    <p className="text-lg font-semibold text-navy">
                      {a.proposed_price != null ? '$' + a.proposed_price.toFixed(2) : '-'}
                    </p>
                  </div>

                  {isOpen && a.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        disabled={busyAppId === a.application_id}
                        onClick={() => handleDecide(a.application_id, 'reject')}
                        className="px-4 py-2 border border-gray-200 text-red-600 text-sm font-semibold rounded-lg hover:border-red-400 disabled:opacity-40 transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        disabled={busyAppId === a.application_id}
                        onClick={() => handleDecide(a.application_id, 'accept')}
                        className="px-4 py-2 bg-teal text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
                      >
                        {busyAppId === a.application_id ? 'Working...' : 'Accept'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
