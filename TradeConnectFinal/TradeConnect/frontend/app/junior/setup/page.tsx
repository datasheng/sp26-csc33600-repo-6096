'use client'

import { useEffect, useState, useRef } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { endorsementsApi, documentsApi } from '@/lib/api'
import type { EndorsementRequest } from '@/types'

function formatBytes(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(1) + ' MB'
}

interface UploadedDoc {
  document_id: number
  original_filename: string
  mime_type: string
  file_size_bytes: number
}

export default function JuniorSetupPage() {
  // Existing requests
  const [requests, setRequests] = useState<EndorsementRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  // Uploads in progress + ready-to-attach docs
  const [stagedDocs, setStagedDocs] = useState<UploadedDoc[]>([])
  const [uploading, setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Endorsement form
  const [supervisorEmail, setSupervisorEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitOK, setSubmitOK] = useState('')

  function reload() {
    setLoading(true); setError('')
    return endorsementsApi.mine()
      .then(r => setRequests(r.requests))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [])

  async function handleUpload(file: File) {
    setUploading(true); setUploadError('')
    try {
      const d = await documentsApi.upload(file)
      setStagedDocs(prev => [...prev, d])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveStaged(id: number) {
    if (!confirm('Remove this document?')) return
    try {
      await documentsApi.delete(id)
      setStagedDocs(prev => prev.filter(d => d.document_id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to remove')
    }
  }

  async function handleSubmit() {
    if (!supervisorEmail.trim()) {
      setSubmitError('Supervisor email is required')
      return
    }
    setSubmitting(true); setSubmitError(''); setSubmitOK('')
    try {
      await endorsementsApi.create({
        supervisor_email: supervisorEmail.trim().toLowerCase(),
        message:          message.trim() || undefined,
        document_ids:     stagedDocs.map(d => d.document_id),
      })
      setSubmitOK('Endorsement request sent. Your supervisor will review it.')
      setSupervisorEmail(''); setMessage('')
      setStagedDocs([])
      await reload()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleWithdraw(id: number) {
    if (!confirm('Withdraw this request?')) return
    try {
      await endorsementsApi.withdraw(id)
      await reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to withdraw')
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const settledRequests = requests.filter(r => r.status !== 'pending')
  const hasApprovedRequest = requests.some(r => r.status === 'approved')

  return (
    <DashboardLayout>
      <div className="p-8 max-w-2xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">My Setup</h1>
        <p className="text-muted mb-8">
          Upload training documents and request endorsement from a senior tradesperson.
        </p>

        {hasApprovedRequest && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-green-800">
            <p className="font-semibold">You are endorsed.</p>
            <p className="text-sm">You can now browse and apply to jobs.</p>
          </div>
        )}

        {/* ── Upload area ─────────────────────────────────────── */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="font-semibold text-navy mb-2">Training Documents</h2>
          <p className="text-sm text-muted mb-4">
            Upload your training certificates, apprenticeship records, or relevant credentials.
            PDF, JPG, or PNG up to 10 MB each.
          </p>

          <label className="block w-full border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-teal transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              disabled={uploading}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
              }}
            />
            <p className="font-medium text-navy">
              {uploading ? 'Uploading...' : 'Click to upload a document'}
            </p>
            <p className="text-xs text-muted mt-1">PDF / JPG / PNG / max 10 MB</p>
          </label>

          {uploadError && (
            <p className="mt-3 text-sm text-red-600">{uploadError}</p>
          )}

          {stagedDocs.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-xs text-muted uppercase tracking-wide">Staged documents</p>
              {stagedDocs.map(d => (
                <div
                  key={d.document_id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy truncate">{d.original_filename}</p>
                    <p className="text-xs text-muted">
                      {d.mime_type} / {formatBytes(d.file_size_bytes)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveStaged(d.document_id)}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold ml-3 shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <p className="text-xs text-muted mt-1">
                These will be attached to the endorsement request when you send it below.
              </p>
            </div>
          )}
        </section>

        {/* ── Endorsement form ────────────────────────────────── */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <h2 className="font-semibold text-navy mb-2">Request Endorsement</h2>
          <p className="text-sm text-muted mb-4">
            Enter the email of the senior tradesperson you want to work under. They will see your
            request and any documents you have staged above, and decide whether to approve.
          </p>

          <div className="flex flex-col gap-3 mb-4">
            <input
              type="email"
              value={supervisorEmail}
              onChange={e => setSupervisorEmail(e.target.value)}
              placeholder="supervisor@email.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal"
            />
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Optional message to your supervisor..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-teal resize-none"
            />
          </div>

          {submitError && <p className="text-red-600 text-sm mb-3">{submitError}</p>}
          {submitOK    && <p className="text-green-700 text-sm mb-3">{submitOK}</p>}

          <button
            onClick={handleSubmit}
            disabled={!supervisorEmail || submitting}
            className="px-6 py-3 bg-navy text-white font-semibold rounded-xl text-sm hover:bg-steel disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Sending...' : 'Send endorsement request'}
          </button>
        </section>

        {/* ── Existing requests ───────────────────────────────── */}
        {loading ? (
          <p className="text-muted text-center py-8">Loading requests...</p>
        ) : error ? (
          <p className="text-red-600 text-center py-8">{error}</p>
        ) : requests.length === 0 ? null : (
          <>
            {pendingRequests.length > 0 && (
              <section className="mb-6">
                <h2 className="font-display text-xl text-navy mb-4">Pending Requests</h2>
                <div className="flex flex-col gap-3">
                  {pendingRequests.map(r => (
                    <RequestCard key={r.endorsement_request_id} r={r} onWithdraw={handleWithdraw} />
                  ))}
                </div>
              </section>
            )}
            {settledRequests.length > 0 && (
              <section>
                <h2 className="font-display text-xl text-navy mb-4">History</h2>
                <div className="flex flex-col gap-3">
                  {settledRequests.map(r => (
                    <RequestCard key={r.endorsement_request_id} r={r} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

function RequestCard({
  r, onWithdraw,
}: {
  r: EndorsementRequest
  onWithdraw?: (id: number) => void
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy">{r.supervisor_name}</p>
          <p className="text-xs text-muted">{r.supervisor_email}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>

      {r.message && (
        <p className="text-sm text-navy/80 whitespace-pre-wrap mb-2">{r.message}</p>
      )}

      {r.documents && r.documents.length > 0 && (
        <p className="text-xs text-muted mb-2">
          {r.documents.length} attached document{r.documents.length === 1 ? '' : 's'}
        </p>
      )}

      {r.decision_note && (
        <div className="bg-gray-50 rounded-lg p-3 mt-2">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">Supervisor note</p>
          <p className="text-sm text-navy/90 whitespace-pre-wrap">{r.decision_note}</p>
        </div>
      )}

      {r.status === 'pending' && onWithdraw && (
        <button
          onClick={() => onWithdraw(r.endorsement_request_id)}
          className="mt-3 text-xs text-red-600 hover:text-red-700 font-semibold"
        >
          Withdraw
        </button>
      )}
    </div>
  )
}
