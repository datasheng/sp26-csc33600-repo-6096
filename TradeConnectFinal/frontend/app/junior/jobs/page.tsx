'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ApplyModal } from '@/components/ui/ApplyModal'
import { jobsApi, type AvailableJob } from '@/lib/api'

export default function JuniorJobsPage() {
  const [filter, setFilter] = useState('')
  const [jobs, setJobs]     = useState<AvailableJob[]>([])
  const [gated, setGated]   = useState<'no_supervisor' | undefined>(undefined)
  const [cap, setCap] = useState({
    job_limit: 5, jobs_taken: 0, remaining: 5,
    active_bookings: 0, pending_applications: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [applyTo, setApplyTo] = useState<AvailableJob | null>(null)

  useEffect(() => {
    jobsApi.cap().then(setCap).catch(() => {})
  }, [])

  function reloadList(q: string) {
    setLoading(true); setError('')
    return jobsApi.available(q.trim() || undefined)
      .then(r => { setJobs(r.jobs); setGated(r.gated) })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(() => { reloadList(filter) }, 250)
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

  const capReached = cap.remaining <= 0
  const capPct = cap.job_limit ? (cap.jobs_taken / cap.job_limit) * 100 : 0

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">Browse Jobs</h1>
        <p className="text-muted mb-6">Open postings in your trade.</p>

        {gated === 'no_supervisor' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-900">
            <p className="font-semibold mb-2">Your endorsement is not yet approved.</p>
            <p className="text-sm mb-3">
              Juniors need an approved supervisor before they can see or apply to jobs.
            </p>
            <Link href="/junior/setup" className="text-teal hover:underline text-sm font-semibold">
              Go to setup
            </Link>
          </div>
        ) : (
          <>
            {/* Job cap bar */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-8">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-navy text-sm">Job Cap</p>
                <p className="text-sm text-muted">{cap.jobs_taken} / {cap.job_limit} slots used</p>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: capPct + '%' }}
                />
              </div>
              <p className="text-xs text-muted mt-2">
                {cap.active_bookings} active booking{cap.active_bookings === 1 ? '' : 's'},{' '}
                {cap.pending_applications} pending application{cap.pending_applications === 1 ? '' : 's'}.
                You can take {cap.remaining} more slot{cap.remaining === 1 ? '' : 's'}.
              </p>
            </div>

            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search by title, description, or city..."
              className="w-full mb-6 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal"
            />

            {loading ? (
              <p className="text-muted text-center py-16">Loading jobs...</p>
            ) : error ? (
              <p className="text-red-600 text-center py-16">{error}</p>
            ) : jobs.length === 0 ? (
              <p className="text-muted text-center py-16">No open postings match your trade right now.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {jobs.map(job => (
                  <div key={job.id}
                    className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
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
                      {(job.budget_min != null || job.budget_max != null) && (
                        <span className="font-display text-xl text-navy">
                          {job.budget_min != null ? '$' + job.budget_min : ''}
                          {job.budget_max != null ? ' - $' + job.budget_max : ''}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-end mt-3 pt-3 border-t border-gray-100">
                      {job.my_application ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted">Your application:</span>
                          <StatusBadge status={job.my_application.status} />
                        </div>
                      ) : (
                        <button
                          disabled={capReached}
                          onClick={() => setApplyTo(job)}
                          className="px-4 py-2 bg-teal text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                        >
                          {capReached ? 'Cap reached' : 'Apply'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {applyTo && (
          <ApplyModal
            job={applyTo}
            onClose={() => setApplyTo(null)}
            onApplied={async () => {
              setApplyTo(null)
              await reloadList(filter)
              try { setCap(await jobsApi.cap()) } catch {}
            }}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
