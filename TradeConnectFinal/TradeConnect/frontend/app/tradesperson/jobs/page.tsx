'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ApplyModal } from '@/components/ui/ApplyModal'
import { jobsApi, type AvailableJob } from '@/lib/api'

export default function TradespersonJobsPage() {
  const [filter, setFilter]   = useState('')
  const [jobs, setJobs]       = useState<AvailableJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [applyTo, setApplyTo] = useState<AvailableJob | null>(null)

  function reload(q: string) {
    setLoading(true); setError('')
    return jobsApi.available(q.trim() || undefined)
      .then(r => setJobs(r.jobs))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }

  // Debounced fetch on filter change
  useEffect(() => {
    const t = setTimeout(() => { reload(filter) }, 250)
    return () => clearTimeout(t)
  }, [filter])

  function relativeTime(iso: string | null): string {
    if (!iso) return ''
    const ms = Date.now() - new Date(iso).getTime()
    const min = Math.floor(ms / 60000)
    if (min < 1)  return 'just now'
    if (min < 60) return min + ' min ago'
    const hr = Math.floor(min / 60)
    if (hr < 24)  return hr + ' hr ago'
    const d = Math.floor(hr / 24)
    return d + ' days ago'
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">Browse Jobs</h1>
        <p className="text-muted mb-6">
          Open job postings in your trade. Apply with your proposed price.
        </p>

        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search by title, description, or city..."
          className="w-full mb-6 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-teal"
        />

        {loading ? (
          <p className="text-muted text-center py-16">Loading jobs...</p>
        ) : error ? (
          <p className="text-red-600 text-center py-16">{error}</p>
        ) : jobs.length === 0 ? (
          <p className="text-muted text-center py-16">
            No open postings match your trade right now.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {jobs.map(job => (
              <div key={job.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2 gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-semibold text-navy">{job.title}</h3>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">
                        {job.trade}
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      {job.employer}{job.city ? ' / ' + job.city : ''}
                      {' / '}{relativeTime(job.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    {(job.budget_min != null || job.budget_max != null) && (
                      <span className="font-display text-xl text-navy">
                        {job.budget_min != null ? '$' + job.budget_min : ''}
                        {job.budget_max != null ? ' - $' + job.budget_max : ''}
                      </span>
                    )}
                  </div>
                </div>

                {job.description && (
                  <p className="text-sm text-navy/80 mt-2 mb-3 line-clamp-2 whitespace-pre-wrap">
                    {job.description}
                  </p>
                )}

                <div className="flex items-center justify-end mt-3 pt-3 border-t border-gray-100">
                  {job.my_application ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted">Your application:</span>
                      <StatusBadge status={job.my_application.status} />
                      {job.my_application.proposed_price != null && (
                        <span className="text-navy font-semibold">
                          (${job.my_application.proposed_price})
                        </span>
                      )}
                      <Link
                        href="/tradesperson/applications"
                        className="text-teal text-xs hover:underline ml-2"
                      >
                        View
                      </Link>
                    </div>
                  ) : (
                    <button
                      onClick={() => setApplyTo(job)}
                      className="px-4 py-2 bg-teal text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Apply
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {applyTo && (
          <ApplyModal
            job={applyTo}
            onClose={() => setApplyTo(null)}
            onApplied={() => { setApplyTo(null); reload(filter) }}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
