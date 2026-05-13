'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { jobPostingsApi } from '@/lib/api'
import type { JobPosting, JobPostingStatus } from '@/types'

const STATUS_FILTERS: (JobPostingStatus | 'all')[] = [
  'all', 'open', 'filled', 'closed', 'cancelled',
]

export default function MyPostingsPage() {
  const [statusFilter, setStatusFilter] = useState<JobPostingStatus | 'all'>('all')
  const [postings, setPostings] = useState<JobPosting[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    jobPostingsApi.list(statusFilter === 'all' ? undefined : { status: statusFilter })
      .then(r => { if (!cancelled) setPostings(r.postings) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [statusFilter])

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto animate-fade-up">
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl text-navy mb-1">My Postings</h1>
            <p className="text-muted">Jobs you have posted and their applications.</p>
          </div>
          <Link
            href="/employer/post-job"
            className="px-5 py-2.5 rounded-xl bg-teal text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            + Post a Job
          </Link>
        </div>

        <div className="flex gap-2 flex-wrap mb-8">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={
                'px-4 py-1.5 rounded-full text-sm font-medium border capitalize transition-all ' +
                (statusFilter === s
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-muted border-gray-200 hover:border-navy')
              }
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-muted text-center py-16">Loading...</p>
        ) : error ? (
          <p className="text-red-600 text-center py-16">{error}</p>
        ) : postings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted mb-3">No postings yet.</p>
            <Link href="/employer/post-job" className="text-teal hover:underline">
              Post your first job
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {postings.map(p => (
              <Link
                key={p.job_posting_id}
                href={'/employer/postings/' + p.job_posting_id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3 gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-navy text-lg truncate">{p.title}</h3>
                    <p className="text-sm text-muted mt-0.5">
                      {p.trade_type}
                      {p.city ? ' / ' + p.city : ''}
                      {' / '}
                      {p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted">
                    <span className="font-semibold text-navy">{p.application_count ?? 0}</span>{' '}
                    application{p.application_count === 1 ? '' : 's'}
                  </div>
                  {(p.budget_min != null || p.budget_max != null) && (
                    <div className="text-navy font-semibold">
                      {p.budget_min != null ? '$' + p.budget_min : ''}
                      {p.budget_max != null ? ' - $' + p.budget_max : ''}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
