'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { jobApplicationsApi } from '@/lib/api'
import type { JobApplication, ApplicationStatus } from '@/types'

const STATUS_FILTERS: (ApplicationStatus | 'all')[] = [
  'all', 'pending', 'accepted', 'rejected', 'withdrawn',
]

export default function MyApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all')
  const [apps, setApps]       = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [busyId, setBusyId]   = useState<number | null>(null)

  function reload() {
    setLoading(true); setError('')
    return jobApplicationsApi.mine(statusFilter === 'all' ? undefined : statusFilter)
      .then(r => setApps(r.applications))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [statusFilter])

  async function handleWithdraw(id: number) {
    if (!confirm('Withdraw this application?')) return
    setBusyId(id)
    try {
      await jobApplicationsApi.withdraw(id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to withdraw')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">My Applications</h1>
        <p className="text-muted mb-8">Job postings you have applied to.</p>

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
        ) : apps.length === 0 ? (
          <p className="text-muted text-center py-16">No applications yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {apps.map(a => (
              <div
                key={a.application_id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between mb-3 gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-navy">{a.posting_title}</h3>
                    <p className="text-sm text-muted mt-0.5">
                      {a.posting_trade}
                      {a.posting_city ? ' / ' + a.posting_city : ''}
                      {' / '}
                      Posted by {a.employer_name}
                    </p>
                    {a.scheduled_at && (
                      <p className="text-xs text-muted mt-0.5">
                        Scheduled for {new Date(a.scheduled_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={a.status} />
                </div>

                {a.message && (
                  <p className="text-sm text-navy/80 mb-3 whitespace-pre-wrap">{a.message}</p>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wide">Your proposed price</p>
                    <p className="text-lg font-semibold text-navy">
                      {a.proposed_price != null ? '$' + a.proposed_price.toFixed(2) : '-'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {a.status === 'pending' && (
                      <button
                        disabled={busyId === a.application_id}
                        onClick={() => handleWithdraw(a.application_id)}
                        className="px-4 py-2 border border-gray-200 text-red-600 text-xs font-semibold rounded-lg hover:border-red-400 disabled:opacity-40 transition-colors"
                      >
                        {busyId === a.application_id ? 'Working...' : 'Withdraw'}
                      </button>
                    )}
                    {a.status === 'accepted' && (
                      <Link
                        href="/bookings"
                        className="px-4 py-2 bg-teal text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                      >
                        View booking
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
