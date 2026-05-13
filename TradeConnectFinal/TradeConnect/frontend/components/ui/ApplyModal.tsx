'use client'

import { useEffect, useState } from 'react'
import { tradespeopleApi, servicesApi, jobApplicationsApi } from '@/lib/api'
import type { AvailableJob } from '@/lib/api'
import type { Service } from '@/types'

interface Props {
  job: AvailableJob
  onClose:  () => void
  onApplied: () => void
}

export function ApplyModal({ job, onClose, onApplied }: Props) {
  const [services, setServices]     = useState<Service[]>([])
  const [serviceId, setServiceId]   = useState<number | ''>('')
  const [price, setPrice]           = useState(
    job.budget_min != null ? String(job.budget_min) : ''
  )
  const [message, setMessage]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  // Pull the user's services so they can pick one to offer.
  // Filter to ones matching the posting's trade.
  useEffect(() => {
    tradespeopleApi.getMe()
      .then(r => servicesApi.getForTradesperson(r.tradesperson.tradesperson_id))
      .then(r => {
        const matching = r.services.filter(s =>
          !s.trade_type || s.trade_type === job.trade
        )
        setServices(matching)
        if (matching[0]) setServiceId(matching[0].service_id)
      })
      .catch(() => setServices([]))
  }, [job.trade])

  async function handleSubmit() {
    const proposed = parseFloat(price)
    if (!Number.isFinite(proposed) || proposed < 0) {
      setError('Enter a valid price')
      return
    }
    setSubmitting(true); setError('')
    try {
      await jobApplicationsApi.create({
        job_posting_id: job.job_posting_id,
        proposed_price: proposed,
        service_id:     serviceId === '' ? undefined : Number(serviceId),
        message:        message.trim() || undefined,
      })
      onApplied()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-display text-xl text-navy mb-1">Apply to: {job.title}</h2>
        <p className="text-muted text-sm mb-5">
          {job.employer}{job.city ? ' / ' + job.city : ''} / {job.trade}
        </p>

        {services.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-4">
            You don&apos;t have any matching services yet. Add a service in your profile first.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Service to offer</label>
              <select
                value={serviceId}
                onChange={e => setServiceId(e.target.value ? Number(e.target.value) : '')}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal"
              >
                <option value="">- Select a service -</option>
                {services.map(s => (
                  <option key={s.service_id} value={s.service_id}>
                    {s.service_name}{s.hourly_rate ? ' ($' + s.hourly_rate + '/hr)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted uppercase tracking-wide">
                Proposed price ($)
                {(job.budget_min != null || job.budget_max != null) && (
                  <span className="ml-1 normal-case text-muted/80">
                    (employer budget:{' '}
                    {job.budget_min != null ? '$' + job.budget_min : ''}
                    {job.budget_max != null ? ' - $' + job.budget_max : ''})
                  </span>
                )}
              </label>
              <input
                type="number" min={0} step={1}
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal"
              />
            </div>

            <div>
              <label className="text-xs text-muted uppercase tracking-wide">Message (optional)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                placeholder="Anything the employer should know about your proposal."
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-teal resize-none"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3 mt-2">
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-navy text-sm font-semibold hover:border-teal transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!price || submitting}
                className="flex-1 py-2.5 rounded-lg bg-teal text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {submitting ? 'Applying...' : 'Submit application'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
