'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { endorsementsApi, documentsApi } from '@/lib/api'
import type { EndorsementRequest, EndorsementStatus } from '@/types'

const STATUS_FILTERS: (EndorsementStatus | 'all')[] = [
  'pending', 'approved', 'rejected', 'all',
]

function formatBytes(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

export default function EndorsementInboxPage() {
  const [statusFilter, setStatusFilter] = useState<EndorsementStatus | 'all'>('pending')
  const [requests, setRequests] = useState<EndorsementRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [busyId, setBusyId]     = useState<number | null>(null)
  const [noteFor, setNoteFor]   = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')

  function reload() {
    setLoading(true); setError('')
    return endorsementsApi.incoming(statusFilter === 'all' ? undefined : statusFilter)
      .then(r => setRequests(r.requests))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [statusFilter])

  async function handleDecide(id: number, decision: 'approve' | 'reject') {
    setBusyId(id)
    try {
      await endorsementsApi.decide(id, decision, noteText.trim() || undefined)
      setNoteFor(null); setNoteText('')
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to ' + decision)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">Endorsement Inbox</h1>
        <p className="text-muted mb-8">
          Junior tradespeople asking you to endorse them.
        </p>

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
        ) : requests.length === 0 ? (
          <p className="text-muted text-center py-16">
            {statusFilter === 'pending'
              ? 'No pending endorsement requests.'
              : 'No requests in this status.'}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {requests.map(r => (
              <div
                key={r.endorsement_request_id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between mb-3 gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-navy">{r.junior_name}</h3>
                    <p className="text-sm text-muted mt-0.5">
                      {r.junior_trade}
                      {r.junior_experience_year != null
                        ? ' / ' + r.junior_experience_year + ' yrs experience'
                        : ''}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{r.junior_email}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                {r.message && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-muted uppercase tracking-wide mb-1">Message</p>
                    <p className="text-sm text-navy/90 whitespace-pre-wrap">{r.message}</p>
                  </div>
                )}

                {r.documents && r.documents.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-muted uppercase tracking-wide mb-2">
                      Documents ({r.documents.length})
                    </p>
                    <div className="flex flex-col gap-2">
                      {r.documents.map(d => (
                        <a
                          key={d.document_id}
                          href={documentsApi.url(d.document_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-navy truncate">
                              {d.original_filename}
                            </p>
                            <p className="text-xs text-muted">
                              {d.mime_type} / {formatBytes(d.file_size_bytes)}
                            </p>
                          </div>
                          <span className="text-xs text-teal font-semibold ml-3 shrink-0">
                            Open
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {r.decision_note && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-muted uppercase tracking-wide mb-1">Your note</p>
                    <p className="text-sm text-navy/90 whitespace-pre-wrap">{r.decision_note}</p>
                  </div>
                )}

                {r.status === 'pending' && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {noteFor === r.endorsement_request_id ? (
                      <div className="flex flex-col gap-3">
                        <textarea
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          rows={2}
                          placeholder="Optional note to share with the junior..."
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal resize-none"
                        />
                        <div className="flex gap-2 flex-wrap">
                          <button
                            disabled={busyId === r.endorsement_request_id}
                            onClick={() => handleDecide(r.endorsement_request_id, 'approve')}
                            className="px-4 py-2 bg-teal text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
                          >
                            Approve
                          </button>
                          <button
                            disabled={busyId === r.endorsement_request_id}
                            onClick={() => handleDecide(r.endorsement_request_id, 'reject')}
                            className="px-4 py-2 border border-gray-200 text-red-600 text-sm font-semibold rounded-lg hover:border-red-400 disabled:opacity-40 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => { setNoteFor(null); setNoteText('') }}
                            className="px-4 py-2 text-muted text-sm font-medium hover:text-navy transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setNoteFor(r.endorsement_request_id); setNoteText('') }}
                        className="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-steel transition-colors"
                      >
                        Review and decide
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
